package com.clientmanagement.service;

import com.clientmanagement.config.SmsConfig;
import com.clientmanagement.entity.Client;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.jboss.logging.Logger;

import java.io.FileInputStream;
import java.io.File;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * Service for importing clients from Excel files.
 */
@ApplicationScoped
public class ExcelImportService {

    private static final Logger LOG = Logger.getLogger(ExcelImportService.class);

    @Inject
    SmsConfig smsConfig;

    // Sheet name to category mapping
    private static final Map<String, String> CATEGORY_MAPPING = Map.ofEntries(
        Map.entry("agri", "Agricultură"),
        Map.entry("agricultura", "Agricultură"),
        Map.entry("constructii", "Construcții"),
        Map.entry("constructie", "Construcții"),
        Map.entry("comert lemn", "Comerț Lemn"),
        Map.entry("lemn", "Comerț Lemn"),
        Map.entry("clienti contactati", "Clienți Contactați"),
        Map.entry("clienti interesati", "Clienți Interesați"),
        Map.entry("tot", "General"),
        Map.entry("foaie1", "General")
    );

    // Sheets to exclude from import
    private static final Set<String> EXCLUDED_SHEETS = Set.of("aaa", "balanta primita", "balanta primita ");

    // Column mapping for "Baza de date clienti 2023.xlsx"
    private static final Map<String, String> COLUMN_MAPPING_2023 = Map.ofEntries(
        Map.entry("Numele Companiei", "companyName"),
        Map.entry("Stare", "status"),
        Map.entry("CUI", "cui"),
        Map.entry("Nr. Inmatriculare", "registrationNumber"),
        Map.entry("Cod CAEN", "caenCode"),
        Map.entry("Sectiune CAEN", "caenSection"),
        Map.entry("Diviziune CAEN", "caenDivision"),
        Map.entry("Grupa CAEN", "caenGroup"),
        Map.entry("Judet", "county"),
        Map.entry("Localitate", "locality"),
        Map.entry("Adresa", "address"),
        Map.entry("Codul Postal", "postalCode"),
        Map.entry("Cifra de Afaceri", "revenue"),
        Map.entry("Profit Net", "netProfit"),
        Map.entry("Platitor TVA", "vatPayer"),
        Map.entry("Cifra de Afaceri 2023", "revenue2023"),
        Map.entry("Cifra de Afaceri 2022", "revenue2022"),
        Map.entry("Profit 2023", "profit2023"),
        Map.entry("Profit 2022", "profit2022"),
        Map.entry("Creante 2023", "receivables2023"),
        Map.entry("Capitaluri proprii 2023", "equity2023"),
        Map.entry("Angajati", "employees"),
        Map.entry("Anul Infiintarii", "foundingYear"),
        Map.entry("Telefon Verificat", "phoneVerified"),
        Map.entry("Telefon Principal", "phonePrimary"),
        Map.entry("Telefon Secundar", "phoneSecondary"),
        Map.entry("Telefon Contact", "phoneContact"),
        Map.entry("Telefon Marketing", "phoneMarketing"),
        Map.entry("Telefon Website", "phoneWebsite"),
        Map.entry("Email Principal", "emailPrimary"),
        Map.entry("Email Secundar", "emailSecondary"),
        Map.entry("Email Marketing", "emailMarketing"),
        Map.entry("Email Website", "emailWebsite"),
        Map.entry("Email Contact", "emailContact"),
        Map.entry("Websites", "websites"),
        Map.entry("Administrator", "administrator"),
        Map.entry("Observatii", "observations")
    );

    // Column mapping for "baza date lorand.xlsx"
    private static final Map<String, String> COLUMN_MAPPING_LORAND = Map.of(
        "Firma", "companyName",
        "Judet", "county",
        "Nr de telefon", "phonePrimary",
        "Observatii", "observations",
        "Data", "contactDate",
        "ID Deal", "dealId"
    );

    public static class ImportResult {
        public int imported = 0;
        public int skipped = 0;
        public List<String> errors = new ArrayList<>();
        public List<String> logs = new ArrayList<>();
    }

    /**
     * Import clients from Excel files.
     */
    @Transactional
    public ImportResult importClientsFromExcel(List<String> filePaths) {
        ImportResult result = new ImportResult();

        for (String filePath : filePaths) {
            try {
                addLog(result, String.format("Processing file: %s", filePath));
                List<Client> clients = parseExcelFile(filePath);
                addLog(result, String.format("Found %d clients to process from %s", clients.size(), filePath));

                for (Client client : clients) {
                    try {
                        // Check for duplicates
                        Client existingClient = null;

                        if (client.phonePrimary != null && !client.phonePrimary.isBlank()) {
                            existingClient = Client.find("companyName = ?1 AND phonePrimary = ?2",
                                client.companyName, client.phonePrimary).firstResult();
                        }

                        if (existingClient == null && client.cui != null && !client.cui.isBlank()) {
                            existingClient = Client.find("cui", client.cui).firstResult();
                        }

                        if (existingClient != null) {
                            result.skipped++;
                            continue;
                        }

                        client.persist();
                        result.imported++;
                    } catch (Exception e) {
                        String errorMsg = String.format("Error importing client %s: %s",
                            client.companyName, e.getMessage());
                        addLog(result, errorMsg, "error");
                        result.errors.add(errorMsg);
                    }
                }

                addLog(result, String.format("Completed processing %s: %d imported so far", filePath, result.imported));
            } catch (Exception e) {
                String errorMsg = String.format("Error processing file %s: %s", filePath, e.getMessage());
                addLog(result, errorMsg, "error");
                result.errors.add(errorMsg);
            }
        }

        addLog(result, String.format("Import complete: %d imported, %d skipped, %d errors",
            result.imported, result.skipped, result.errors.size()));
        return result;
    }

    private List<Client> parseExcelFile(String filePath) throws Exception {
        List<Client> clients = new ArrayList<>();
        String fileName = new File(filePath).getName();
        boolean isLorandFile = fileName.toLowerCase().contains("lorand");
        Map<String, String> columnMapping = isLorandFile ? COLUMN_MAPPING_LORAND : COLUMN_MAPPING_2023;

        try (FileInputStream fis = new FileInputStream(filePath);
             Workbook workbook = new XSSFWorkbook(fis)) {

            for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
                Sheet sheet = workbook.getSheetAt(sheetIndex);
                String sheetName = sheet.getSheetName();

                // Skip empty or excluded sheets
                if (sheet.getLastRowNum() < 1) continue;
                String normalizedSheetName = sheetName.toLowerCase().trim();
                if (EXCLUDED_SHEETS.stream().anyMatch(normalizedSheetName::contains)) continue;

                // Determine category from sheet name
                String category = getCategoryFromSheetName(sheetName);

                // Get header row
                Row headerRow = sheet.getRow(0);
                if (headerRow == null) continue;

                Map<String, Integer> columnIndices = new HashMap<>();
                for (int colIndex = 0; colIndex < headerRow.getLastCellNum(); colIndex++) {
                    Cell cell = headerRow.getCell(colIndex);
                    if (cell != null) {
                        String header = getCellStringValue(cell);
                        if (header != null && columnMapping.containsKey(header)) {
                            columnIndices.put(columnMapping.get(header), colIndex);
                        }
                    }
                    // Handle special index-based columns for Lorand file
                    if (isLorandFile && colIndex == 4) {
                        columnIndices.put("contactPerson", colIndex);
                    }
                }

                // Check if we have essential columns
                if (!columnIndices.containsKey("companyName") && !columnIndices.containsKey("phonePrimary")) {
                    LOG.warnf("Skipping sheet \"%s\" - no essential columns found", sheetName);
                    continue;
                }

                // Parse data rows
                int sheetClientCount = 0;
                for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                    Row row = sheet.getRow(rowIndex);
                    if (row == null) continue;

                    // Skip empty rows
                    String companyName = columnIndices.containsKey("companyName") ?
                        getCellStringValue(row.getCell(columnIndices.get("companyName"))) : null;
                    String phone = columnIndices.containsKey("phonePrimary") ?
                        getCellStringValue(row.getCell(columnIndices.get("phonePrimary"))) : null;

                    if ((companyName == null || companyName.isBlank()) && 
                        (phone == null || phone.isBlank())) continue;

                    // Generate company name from phone if not available
                    if (companyName == null || companyName.isBlank()) {
                        companyName = phone != null ? "Client " + phone : "Unknown Company";
                    }

                    Client client = new Client();
                    client.companyName = companyName;
                    client.category = category;
                    client.sourceFile = fileName;
                    client.sourceSheet = sheetName;

                    // Map all columns
                    for (Map.Entry<String, Integer> entry : columnIndices.entrySet()) {
                        String field = entry.getKey();
                        Cell cell = row.getCell(entry.getValue());

                        if (cell == null || field.equals("companyName")) continue;

                        switch (field) {
                            case "status": client.status = getCellStringValue(cell); break;
                            case "cui": client.cui = getCellStringValue(cell); break;
                            case "registrationNumber": client.registrationNumber = getCellStringValue(cell); break;
                            case "caenCode": client.caenCode = getCellStringValue(cell); break;
                            case "caenSection": client.caenSection = getCellStringValue(cell); break;
                            case "caenDivision": client.caenDivision = getCellStringValue(cell); break;
                            case "caenGroup": client.caenGroup = getCellStringValue(cell); break;
                            case "county": client.county = getCellStringValue(cell); break;
                            case "locality": client.locality = getCellStringValue(cell); break;
                            case "address": client.address = getCellStringValue(cell); break;
                            case "postalCode": client.postalCode = getCellStringValue(cell); break;
                            case "revenue": client.revenue = getCellNumericValue(cell); break;
                            case "netProfit": client.netProfit = getCellNumericValue(cell); break;
                            case "vatPayer": client.vatPayer = getCellBooleanValue(cell); break;
                            case "revenue2023": client.revenue2023 = getCellNumericValue(cell); break;
                            case "revenue2022": client.revenue2022 = getCellNumericValue(cell); break;
                            case "profit2023": client.profit2023 = getCellNumericValue(cell); break;
                            case "profit2022": client.profit2022 = getCellNumericValue(cell); break;
                            case "receivables2023": client.receivables2023 = getCellNumericValue(cell); break;
                            case "equity2023": client.equity2023 = getCellNumericValue(cell); break;
                            case "employees": {
                                Double val = getCellNumericValue(cell);
                                client.employees = val != null ? val.intValue() : null;
                                break;
                            }
                            case "foundingYear": {
                                Double val = getCellNumericValue(cell);
                                client.foundingYear = val != null ? val.intValue() : null;
                                break;
                            }
                            case "phoneVerified": client.phoneVerified = normalizePhoneNumber(getCellStringValue(cell)); break;
                            case "phonePrimary": client.phonePrimary = normalizePhoneNumber(getCellStringValue(cell)); break;
                            case "phoneSecondary": client.phoneSecondary = normalizePhoneNumber(getCellStringValue(cell)); break;
                            case "phoneContact": client.phoneContact = normalizePhoneNumber(getCellStringValue(cell)); break;
                            case "phoneMarketing": client.phoneMarketing = normalizePhoneNumber(getCellStringValue(cell)); break;
                            case "phoneWebsite": client.phoneWebsite = normalizePhoneNumber(getCellStringValue(cell)); break;
                            case "emailPrimary": client.emailPrimary = getCellStringValue(cell); break;
                            case "emailSecondary": client.emailSecondary = getCellStringValue(cell); break;
                            case "emailMarketing": client.emailMarketing = getCellStringValue(cell); break;
                            case "emailWebsite": client.emailWebsite = getCellStringValue(cell); break;
                            case "emailContact": client.emailContact = getCellStringValue(cell); break;
                            case "websites": client.websites = getCellStringValue(cell); break;
                            case "administrator": client.administrator = getCellStringValue(cell); break;
                            case "contactPerson": client.contactPerson = getCellStringValue(cell); break;
                            case "contactDate": client.contactDate = getCellDateValue(cell); break;
                            case "dealId": client.dealId = getCellStringValue(cell); break;
                            case "observations": client.observations = getCellStringValue(cell); break;
                        }
                    }

                    clients.add(client);
                    sheetClientCount++;
                }

                LOG.infof("Parsed %d clients from sheet \"%s\" (category: %s) in file \"%s\"",
                    sheetClientCount, sheetName, category, fileName);
            }
        }

        return clients;
    }

    private String getCategoryFromSheetName(String sheetName) {
        String normalizedName = sheetName.toLowerCase().trim();
        for (Map.Entry<String, String> entry : CATEGORY_MAPPING.entrySet()) {
            if (normalizedName.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return "General";
    }

    private String getCellStringValue(Cell cell) {
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case STRING:
                String value = cell.getStringCellValue().trim();
                return value.isEmpty() ? null : value;
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toString();
                }
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue().trim();
                } catch (Exception e) {
                    try {
                        return String.valueOf(cell.getNumericCellValue());
                    } catch (Exception e2) {
                        return null;
                    }
                }
            default:
                return null;
        }
    }

    private Double getCellNumericValue(Cell cell) {
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case NUMERIC:
                return cell.getNumericCellValue();
            case STRING:
                try {
                    return Double.parseDouble(cell.getStringCellValue().trim());
                } catch (NumberFormatException e) {
                    return null;
                }
            case FORMULA:
                try {
                    return cell.getNumericCellValue();
                } catch (Exception e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private Boolean getCellBooleanValue(Cell cell) {
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case BOOLEAN:
                return cell.getBooleanCellValue();
            case STRING:
                String value = cell.getStringCellValue().toLowerCase().trim();
                return "da".equals(value) || "yes".equals(value) || "true".equals(value) || "1".equals(value);
            case NUMERIC:
                return cell.getNumericCellValue() == 1;
            default:
                return null;
        }
    }

    private LocalDateTime getCellDateValue(Cell cell) {
        if (cell == null) return null;

        switch (cell.getCellType()) {
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue();
                }
                return null;
            case STRING:
                String value = cell.getStringCellValue().trim().replaceAll("\\.$", "");
                // Try DD.MM.YYYY format
                if (value.matches("\\d{1,2}\\.\\d{1,2}\\.\\d{4}")) {
                    String[] parts = value.split("\\.");
                    try {
                        return LocalDateTime.of(
                            Integer.parseInt(parts[2]),
                            Integer.parseInt(parts[1]),
                            Integer.parseInt(parts[0]),
                            0, 0
                        );
                    } catch (Exception e) {
                        return null;
                    }
                }
                return null;
            default:
                return null;
        }
    }

    private String normalizePhoneNumber(String phone) {
        if (phone == null || phone.isBlank()) return null;

        // Remove all non-digit characters except +
        String normalized = phone.replaceAll("[^\\d+]", "");

        // Handle phone numbers using the configured default country code
        String defaultCountryCode = smsConfig.bestPractices().defaultCountryCode();
        if (normalized.startsWith("0")) {
            normalized = defaultCountryCode + normalized.substring(1);
        } else if (!normalized.startsWith("+") && defaultCountryCode != null) {
            normalized = defaultCountryCode + normalized;
        }

        return normalized;
    }

    private void addLog(ImportResult result, String message) {
        addLog(result, message, "info");
    }

    private void addLog(ImportResult result, String message, String level) {
        String timestamp = LocalDateTime.now().toString();
        result.logs.add(String.format("[%s] %s", timestamp, message));

        switch (level) {
            case "error": LOG.error(message); break;
            case "warn": LOG.warn(message); break;
            default: LOG.info(message); break;
        }
    }
}
