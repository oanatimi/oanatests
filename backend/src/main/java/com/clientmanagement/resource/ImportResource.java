package com.clientmanagement.resource;

import com.clientmanagement.config.ExcelConfig;
import com.clientmanagement.dto.ApiResponse;
import com.clientmanagement.dto.ImportRequest;
import com.clientmanagement.dto.ImportResultDto;
import com.clientmanagement.service.ExcelImportService;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.io.File;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * REST resource for Excel import operations.
 */
@Path("/api/import")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ImportResource {

    private static final Logger LOG = Logger.getLogger(ImportResource.class);

    @Inject
    ExcelImportService excelImportService;

    @Inject
    ExcelConfig excelConfig;

    /**
     * Import clients from Excel files.
     */
    @POST
    @Path("/clients")
    @Transactional
    public Response importClients(ImportRequest request) {
        try {
            // Determine base directory from config
            String baseDir = excelConfig.dataDirectory();

            // Safely resolve and validate requested directory
            java.nio.file.Path basePath = Paths.get(baseDir).toAbsolutePath().normalize();
            java.nio.file.Path dataPath = basePath;

            if (request != null && request.directory != null && !request.directory.trim().isEmpty()) {
                java.nio.file.Path requestedPath = basePath.resolve(request.directory).normalize();

                // Prevent directory traversal
                if (!requestedPath.startsWith(basePath)) {
                    return Response.status(Response.Status.BAD_REQUEST)
                        .entity(ApiResponse.error("The specified directory path is invalid or not allowed."))
                        .build();
                }

                dataPath = requestedPath;
            }

            // Get Excel files from directory
            List<String> excelFiles = getExcelFilesFromDirectory(dataPath.toFile());

            if (excelFiles.isEmpty()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiResponse.error("No Excel files (.xlsx) were found in the specified directory. Please check the path and try again."))
                    .build();
            }

            // Import clients
            ExcelImportService.ImportResult result = excelImportService.importClientsFromExcel(excelFiles);

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
            LOG.errorf("Error importing clients: %s", e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiResponse.error("Error importing clients"))
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
}
