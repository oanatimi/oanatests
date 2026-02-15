package com.clientmanagement.resource;

import com.clientmanagement.config.ExcelConfig;
import com.clientmanagement.dto.ApiResponse;
import com.clientmanagement.dto.ImportRequest;
import com.clientmanagement.dto.ImportResultDto;
import com.clientmanagement.service.ExcelImportService;
import io.smallrye.common.annotation.Blocking;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.jboss.resteasy.reactive.RestForm;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

/**
 * REST resource for Excel import operations.
 */
@Path("/api/import")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ImportResource {

    private static final Logger LOG = Logger.getLogger(ImportResource.class);
    private static final int MAX_LOG_INPUT_LENGTH = 100;

    @Inject
    ExcelImportService excelImportService;

    @Inject
    ExcelConfig excelConfig;

    /**
     * Import clients from Excel files.
     */
    @POST
    @Path("/clients")
    @Blocking
    @Transactional
    public Response importClients(ImportRequest request) {
        String logMessage = request != null 
            ? "directory=" + sanitizeForLog(request.directory) 
            : "null request body";
        LOG.infof("Received import request: %s", logMessage);
        
        try {
            // Determine base directory from config
            String baseDir = excelConfig.dataDirectory();
            LOG.debugf("Using configured data directory");

            // Safely resolve and validate requested directory
            java.nio.file.Path basePath = Paths.get(baseDir).toAbsolutePath().normalize();
            java.nio.file.Path dataPath = basePath;

            if (request != null && request.directory != null && !request.directory.trim().isEmpty()) {
                java.nio.file.Path requestedPath = basePath.resolve(request.directory).normalize();

                // Prevent directory traversal
                if (!requestedPath.startsWith(basePath)) {
                    LOG.warnf("Directory traversal attempt detected - invalid path requested");
                    return Response.status(Response.Status.BAD_REQUEST)
                        .entity(ApiResponse.error("The specified directory path is invalid or not allowed."))
                        .build();
                }

                dataPath = requestedPath;
            }

            LOG.debugf("Searching for Excel files in configured directory");
            
            // Get Excel files from directory
            List<String> excelFiles = getExcelFilesFromDirectory(dataPath.toFile());
            LOG.infof("Found %d Excel files", excelFiles.size());

            if (excelFiles.isEmpty()) {
                boolean dirExists = dataPath.toFile().exists();
                boolean isDir = dataPath.toFile().isDirectory();
                LOG.warnf("No Excel files found (directory exists=%s, isDirectory=%s)", dirExists, isDir);
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("No Excel files (.xlsx) were found in the specified directory. Please check the path and try again."))
                    .build();
            }

            // Import clients
            LOG.infof("Starting import from %d Excel files", excelFiles.size());
            ExcelImportService.ImportResult result = excelImportService.importClientsFromExcel(excelFiles);
            LOG.infof("Import completed: %d imported, %d skipped, %d errors", 
                result.imported, result.skipped, result.errors.size());

            ImportResultDto dto = new ImportResultDto();
            dto.filesProcessed = excelFiles.size();
            dto.imported = result.imported;
            dto.skipped = result.skipped;
            dto.errors = result.errors;
            dto.logs = result.logs;

            StringBuilder message = new StringBuilder();
            message.append(String.format("Import completed! %d client(s) imported from %d file(s).", result.imported, excelFiles.size()));
            if (result.skipped > 0) {
                message.append(String.format(" %d duplicate(s) skipped.", result.skipped));
            }
            if (!result.errors.isEmpty()) {
                message.append(String.format(" %d error(s) encountered.", result.errors.size()));
            }

            return Response.ok(ApiResponse.success(dto, message.toString())).build();
        } catch (Exception e) {
            LOG.errorf(e, "Error importing clients: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error importing clients"))
                .build();
        }
    }

    /**
     * Import clients from uploaded Excel files.
     * Supports file uploads via multipart/form-data for mobile and desktop browsers.
     */
    @POST
    @Path("/clients/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Blocking
    @Transactional
    public Response importClientsFromUpload(@RestForm("files") List<FileUpload> files) {
        LOG.infof("Received file upload import request with %d files", files != null ? files.size() : 0);
        
        try {
            if (files == null || files.isEmpty()) {
                LOG.warn("No files provided in upload request");
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("No files were uploaded. Please select at least one Excel file (.xlsx or .xls)."))
                    .build();
            }

            // Validate and process uploaded files
            List<ExcelImportService.UploadedFile> uploadedFiles = new ArrayList<>();
            List<String> invalidFiles = new ArrayList<>();
            
            // Allowed Excel MIME types and extensions
            Set<String> allowedMimeTypes = Set.of(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
                "application/octet-stream"
            );
            Set<String> allowedExtensions = Set.of(".xlsx", ".xls");
            
            for (FileUpload file : files) {
                String fileName = file.fileName();
                String contentType = file.contentType();
                long fileSize = file.size();
                
                LOG.debugf("Processing uploaded file: name=%s, type=%s, size=%d", 
                    sanitizeForLog(fileName), contentType, fileSize);
                
                // Validate file extension
                String lowerFileName = fileName.toLowerCase();
                boolean hasValidExtension = allowedExtensions.stream()
                    .anyMatch(lowerFileName::endsWith);
                
                if (!hasValidExtension) {
                    invalidFiles.add(fileName + " (invalid extension, must be .xlsx or .xls)");
                    continue;
                }
                
                // Validate MIME type (allow octet-stream for mobile browsers)
                if (contentType != null && !allowedMimeTypes.contains(contentType)) {
                    LOG.warnf("Unexpected MIME type for %s: %s", sanitizeForLog(fileName), contentType);
                }
                
                // Validate file size (max 50MB)
                if (fileSize > 50 * 1024 * 1024) {
                    invalidFiles.add(fileName + " (file too large, max 50MB)");
                    continue;
                }
                
                // Read file content
                try (InputStream inputStream = Files.newInputStream(file.filePath())) {
                    // We need to read the content into memory since the file might be deleted after request
                    byte[] content = inputStream.readAllBytes();
                    uploadedFiles.add(new ExcelImportService.UploadedFile(
                        new java.io.ByteArrayInputStream(content),
                        fileName
                    ));
                }
            }
            
            if (!invalidFiles.isEmpty()) {
                String errorMessage = "Invalid files: " + String.join(", ", invalidFiles);
                if (uploadedFiles.isEmpty()) {
                    return Response.status(Response.Status.BAD_REQUEST)
                        .entity(ApiResponse.error(errorMessage))
                        .build();
                }
                LOG.warnf("Some files were invalid: %s", errorMessage);
            }
            
            if (uploadedFiles.isEmpty()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("No valid Excel files were uploaded."))
                    .build();
            }
            
            // Import clients from uploaded files
            LOG.infof("Starting import from %d uploaded Excel files", uploadedFiles.size());
            ExcelImportService.ImportResult result = excelImportService.importClientsFromUploadedFiles(uploadedFiles);
            LOG.infof("Upload import completed: %d imported, %d skipped, %d errors", 
                result.imported, result.skipped, result.errors.size());
            
            ImportResultDto dto = new ImportResultDto();
            dto.filesProcessed = uploadedFiles.size();
            dto.imported = result.imported;
            dto.skipped = result.skipped;
            dto.errors = result.errors;
            dto.logs = result.logs;
            
            // Add invalid file warnings to errors if any
            if (!invalidFiles.isEmpty()) {
                for (String invalidFile : invalidFiles) {
                    dto.errors.add(0, "Skipped: " + invalidFile);
                }
            }
            
            StringBuilder message = new StringBuilder();
            message.append(String.format("Import completed! %d client(s) imported from %d file(s).", 
                result.imported, uploadedFiles.size()));
            if (result.skipped > 0) {
                message.append(String.format(" %d duplicate(s) skipped.", result.skipped));
            }
            if (!result.errors.isEmpty()) {
                message.append(String.format(" %d error(s) encountered.", result.errors.size()));
            }
            
            return Response.ok(ApiResponse.success(dto, message.toString())).build();
        } catch (Exception e) {
            LOG.errorf(e, "Error importing clients from uploaded files: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error importing clients from uploaded files"))
                .build();
        }
    }

    private List<String> getExcelFilesFromDirectory(File directory) {
        List<String> files = new ArrayList<>();
        if (directory.exists() && directory.isDirectory()) {
            File[] fileList = directory.listFiles((dir, name) -> 
                name.endsWith(".xlsx") || name.endsWith(".xls")
            );
            if (fileList != null) {
                for (File file : fileList) {
                    files.add(file.getAbsolutePath());
                }
            }
        }
        return files;
    }

    /**
     * Sanitize user input for safe logging by removing potentially dangerous characters.
     */
    private String sanitizeForLog(String input) {
        if (input == null) {
            return "null";
        }
        // Remove newlines, carriage returns, and ANSI escape sequences to prevent log injection
        String sanitized = input.replaceAll("[\\r\\n]", " ")
                                .replaceAll("\\x1b\\[[0-9;]*m", "")
                                .replaceAll("[\\x00-\\x1f]", "");
        // Limit length to prevent log flooding
        if (sanitized.length() > MAX_LOG_INPUT_LENGTH) {
            sanitized = sanitized.substring(0, MAX_LOG_INPUT_LENGTH) + "...";
        }
        return sanitized;
    }
}
