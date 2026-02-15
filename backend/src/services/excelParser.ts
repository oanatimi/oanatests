import ExcelJS from 'exceljs';
import path from 'path';
import { logger } from '../utils/logger';
import { query, queryOne, execute } from '../config/database';
import { config } from '../config';
import { Client } from '../types/database';

interface ClientData {
  companyName: string;
  status?: string;
  category?: string;
  cui?: string;
  registrationNumber?: string;
  caenCode?: string;
  caenSection?: string;
  caenDivision?: string;
  caenGroup?: string;
  county?: string;
  locality?: string;
  address?: string;
  postalCode?: string;
  revenue?: number;
  netProfit?: number;
  vatPayer?: boolean;
  revenue2023?: number;
  revenue2022?: number;
  profit2023?: number;
  profit2022?: number;
  receivables2023?: number;
  equity2023?: number;
  employees?: number;
  foundingYear?: number;
  phoneVerified?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  phoneContact?: string;
  phoneMarketing?: string;
  phoneWebsite?: string;
  emailPrimary?: string;
  emailSecondary?: string;
  emailMarketing?: string;
  emailWebsite?: string;
  emailContact?: string;
  websites?: string;
  administrator?: string;
  contactPerson?: string;
  contactDate?: Date;
  dealId?: string;
  observations?: string;
  sourceFile?: string;
  sourceSheet?: string;
}

// Sheet name to category mapping
const CATEGORY_MAPPING: Record<string, string> = {
  'agri': 'Agricultură',
  'agricultura': 'Agricultură',
  'constructii': 'Construcții',
  'constructie': 'Construcții',
  'comert lemn': 'Comerț Lemn',
  'lemn': 'Comerț Lemn',
  'clienti contactati': 'Clienți Contactați',
  'clienti interesati': 'Clienți Interesați',
  'tot': 'General',
  'foaie1': 'General',
};

// Sheets to exclude from import
const EXCLUDED_SHEETS = ['aaa', 'balanta primita', 'balanta primita '];

// Column mapping for "Baza de date clienti 2023.xlsx"
const COLUMN_MAPPING_2023: Record<string, keyof ClientData> = {
  'Numele Companiei': 'companyName',
  'Stare': 'status',
  'CUI': 'cui',
  'Nr. Inmatriculare': 'registrationNumber',
  'Cod CAEN': 'caenCode',
  'Sectiune CAEN': 'caenSection',
  'Diviziune CAEN': 'caenDivision',
  'Grupa CAEN': 'caenGroup',
  'Judet': 'county',
  'Localitate': 'locality',
  'Adresa': 'address',
  'Codul Postal': 'postalCode',
  'Cifra de Afaceri': 'revenue',
  'Profit Net': 'netProfit',
  'Platitor TVA': 'vatPayer',
  'Cifra de Afaceri 2023': 'revenue2023',
  'Cifra de Afaceri 2022': 'revenue2022',
  'Profit 2023': 'profit2023',
  'Profit 2022': 'profit2022',
  'Creante 2023': 'receivables2023',
  'Capitaluri proprii 2023': 'equity2023',
  'Angajati': 'employees',
  'Anul Infiintarii': 'foundingYear',
  'Telefon Verificat': 'phoneVerified',
  'Telefon Principal': 'phonePrimary',
  'Telefon Secundar': 'phoneSecondary',
  'Telefon Contact': 'phoneContact',
  'Telefon Marketing': 'phoneMarketing',
  'Telefon Website': 'phoneWebsite',
  'Email Principal': 'emailPrimary',
  'Email Secundar': 'emailSecondary',
  'Email Marketing': 'emailMarketing',
  'Email Website': 'emailWebsite',
  'Email Contact': 'emailContact',
  'Websites': 'websites',
  'Administrator': 'administrator',
  'Observatii': 'observations',
};

// Column mapping for "baza date lorand.xlsx"
const COLUMN_MAPPING_LORAND: Record<string, keyof ClientData> = {
  'Firma': 'companyName',
  'Judet': 'county',
  'Nr de telefon': 'phonePrimary',
  'Observatii': 'observations',
  'Data': 'contactDate',
  'ID Deal': 'dealId',
};

// Index-based column mapping for lorand file (column 4 is contact person)
const LORAND_SPECIAL_COLUMNS: Record<number, keyof ClientData> = {
  4: 'contactPerson',
};

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase();
  return str === 'da' || str === 'yes' || str === 'true' || str === '1';
}

function cleanString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  
  // Handle ExcelJS rich text objects
  if (typeof value === 'object' && value !== null) {
    // Rich text has a 'richText' property with array of text segments
    if ('richText' in value && Array.isArray((value as { richText: unknown[] }).richText)) {
      const richText = (value as { richText: Array<{ text?: string }> }).richText;
      const str = richText.map(rt => rt.text || '').join('').trim();
      return str === '' ? undefined : str;
    }
    // Handle other object types - try to extract text property
    if ('text' in value && typeof (value as { text: unknown }).text === 'string') {
      const str = (value as { text: string }).text.trim();
      return str === '' ? undefined : str;
    }
    // Handle result/formula objects
    if ('result' in value) {
      return cleanString((value as { result: unknown }).result);
    }
  }
  
  const str = String(value).trim();
  return str === '' ? undefined : str;
}

function parseDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return value;
  
  // Try to parse string dates like "01.02.2022." or "01.02.2022"
  const strValue = String(value).replace(/\.$/, '').trim();
  
  // Try DD.MM.YYYY format
  const ddmmyyyy = strValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try standard date parsing
  const date = new Date(strValue);
  return isNaN(date.getTime()) ? undefined : date;
}

function normalizePhoneNumber(
  phone: string | undefined,
  defaultCountryCode: string = config.smsBestPractices.defaultCountryCode
): string | undefined {
  if (!phone) return undefined;
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  // Handle phone numbers using the configured default country code
  if (normalized.startsWith('0')) {
    normalized = defaultCountryCode + normalized.substring(1);
  } else if (!normalized.startsWith('+') && defaultCountryCode) {
    normalized = defaultCountryCode + normalized;
  }
  return normalized;
}

function getCategoryFromSheetName(sheetName: string): string {
  const normalizedName = sheetName.toLowerCase().trim();
  for (const [key, category] of Object.entries(CATEGORY_MAPPING)) {
    if (normalizedName.includes(key)) {
      return category;
    }
  }
  return 'General'; // Default category for unmatched sheets
}

async function parseExcelFile(filePath: string): Promise<ClientData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const fileName = path.basename(filePath);
  const clients: ClientData[] = [];
  const isLorandFile = fileName.toLowerCase().includes('lorand');
  const columnMapping = isLorandFile ? COLUMN_MAPPING_LORAND : COLUMN_MAPPING_2023;
  
  // Sort worksheets: process specialized sheets first, then general sheets like "Tot"
  // This ensures proper categorization when duplicates exist
  const sortedWorksheets = [...workbook.worksheets].sort((a, b) => {
    const generalSheets = ['tot', 'foaie1', 'general'];
    const aIsGeneral = generalSheets.includes(a.name.toLowerCase().trim());
    const bIsGeneral = generalSheets.includes(b.name.toLowerCase().trim());
    if (aIsGeneral && !bIsGeneral) return 1;  // Push general sheets to end
    if (!aIsGeneral && bIsGeneral) return -1; // Specialized sheets first
    return 0;
  });
  
  for (const worksheet of sortedWorksheets) {
    const sheetName = worksheet.name;
    
    // Skip empty or irrelevant sheets
    if (worksheet.rowCount < 2) continue;
    const normalizedSheetName = sheetName.toLowerCase().trim();
    if (EXCLUDED_SHEETS.some(excluded => normalizedSheetName.includes(excluded))) continue;
    
    // Determine category from sheet name
    const category = getCategoryFromSheetName(sheetName);
    
    // Get header row
    const headerRow = worksheet.getRow(1);
    const columnIndices: Record<string, number> = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const header = cleanString(cell.value);
      if (header && columnMapping[header]) {
        columnIndices[columnMapping[header]] = colNumber;
      }
      // Handle special index-based columns for Lorand file
      if (isLorandFile && LORAND_SPECIAL_COLUMNS[colNumber]) {
        columnIndices[LORAND_SPECIAL_COLUMNS[colNumber]] = colNumber;
      }
    });
    
    // Check if we have essential columns
    if (!columnIndices['companyName'] && !columnIndices['phonePrimary']) {
      logger.warn(`Skipping sheet "${sheetName}" - no essential columns found`);
      continue;
    }
    
    // Parse data rows
    let sheetClientCount = 0;
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // Skip empty rows
      const companyNameCell = columnIndices['companyName'] 
        ? row.getCell(columnIndices['companyName']).value 
        : null;
      const phoneCell = columnIndices['phonePrimary']
        ? row.getCell(columnIndices['phonePrimary']).value
        : null;
        
      if (!companyNameCell && !phoneCell) continue;
      
      // Generate company name from phone if not available
      const companyName = cleanString(companyNameCell) || 
        (phoneCell ? `Client ${cleanString(phoneCell)}` : 'Unknown Company');
      
      const client: ClientData = {
        companyName: companyName,
        category: category,
        sourceFile: fileName,
        sourceSheet: sheetName,
      };
      
      // Map all columns
      for (const [field, colIndex] of Object.entries(columnIndices)) {
        const cellValue = row.getCell(colIndex).value;
        
        // Skip companyName since we already set it
        if (field === 'companyName') continue;
        
        switch (field) {
          case 'revenue':
          case 'netProfit':
          case 'revenue2023':
          case 'revenue2022':
          case 'profit2023':
          case 'profit2022':
          case 'receivables2023':
          case 'equity2023':
            (client as unknown as Record<string, number | undefined>)[field] = parseNumber(cellValue);
            break;
          case 'employees':
          case 'foundingYear':
            (client as unknown as Record<string, number | undefined>)[field] = parseNumber(cellValue);
            break;
          case 'vatPayer':
            client.vatPayer = parseBoolean(cellValue);
            break;
          case 'phonePrimary':
          case 'phoneSecondary':
          case 'phoneContact':
          case 'phoneMarketing':
          case 'phoneWebsite':
          case 'phoneVerified':
            (client as unknown as Record<string, string | undefined>)[field] = normalizePhoneNumber(cleanString(cellValue));
            break;
          case 'contactDate':
            client.contactDate = parseDate(cellValue);
            break;
          case 'observations':
            // Preserve full observations text
            client.observations = cleanString(cellValue);
            break;
          default:
            (client as unknown as Record<string, string | undefined>)[field] = cleanString(cellValue);
        }
      }
      
      clients.push(client);
      sheetClientCount++;
    }
    
    logger.info(`Parsed ${sheetClientCount} clients from sheet "${sheetName}" (category: ${category}) in file "${fileName}"`);
  }
  
  return clients;
}

export async function importClientsFromExcel(filePaths: string[]): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
  logs: string[];
}> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const logs: string[] = [];
  
  // Helper to add log entry and also log to winston
  const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    if (level === 'error') {
      logger.error(message);
    } else if (level === 'warn') {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  };
  
  for (const filePath of filePaths) {
    try {
      addLog(`Processing file: ${filePath}`);
      const clients = await parseExcelFile(filePath);
      
      addLog(`Found ${clients.length} clients to process from ${filePath}`);
      
      for (const clientData of clients) {
        try {
          // Check for duplicates based on company name and primary phone, or CUI
          let existingClient: Client | null = null;
          
          if (clientData.phonePrimary) {
            existingClient = await queryOne<Client>(
              'SELECT * FROM "Client" WHERE "companyName" = $1 AND "phonePrimary" = $2 LIMIT 1',
              [clientData.companyName, clientData.phonePrimary]
            );
          }
          
          if (!existingClient && clientData.cui) {
            existingClient = await queryOne<Client>(
              'SELECT * FROM "Client" WHERE cui = $1 LIMIT 1',
              [clientData.cui]
            );
          }
          
          if (existingClient) {
            skipped++;
            continue;
          }
          
          // Insert with fixed column list (prevents SQL injection)
          // The column list matches the ClientData interface
          await execute(
            `INSERT INTO "Client" (
              id, "companyName", status, category, cui, "registrationNumber",
              "caenCode", "caenSection", "caenDivision", "caenGroup",
              county, locality, address, "postalCode",
              revenue, "netProfit", "vatPayer",
              "revenue2023", "revenue2022", "profit2023", "profit2022",
              "receivables2023", "equity2023", employees, "foundingYear",
              "phoneVerified", "phonePrimary", "phoneSecondary", "phoneContact", "phoneMarketing", "phoneWebsite",
              "emailPrimary", "emailSecondary", "emailMarketing", "emailWebsite", "emailContact",
              websites, administrator, "contactPerson", "contactDate", "dealId", observations,
              "sourceFile", "sourceSheet", "importedAt", "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13,
              $14, $15, $16,
              $17, $18, $19, $20,
              $21, $22, $23, $24,
              $25, $26, $27, $28, $29, $30,
              $31, $32, $33, $34, $35,
              $36, $37, $38, $39, $40, $41,
              $42, $43, NOW(), NOW(), NOW()
            )`,
            [
              clientData.companyName, clientData.status, clientData.category, clientData.cui, clientData.registrationNumber,
              clientData.caenCode, clientData.caenSection, clientData.caenDivision, clientData.caenGroup,
              clientData.county, clientData.locality, clientData.address, clientData.postalCode,
              clientData.revenue, clientData.netProfit, clientData.vatPayer,
              clientData.revenue2023, clientData.revenue2022, clientData.profit2023, clientData.profit2022,
              clientData.receivables2023, clientData.equity2023, clientData.employees, clientData.foundingYear,
              clientData.phoneVerified, clientData.phonePrimary, clientData.phoneSecondary, clientData.phoneContact, clientData.phoneMarketing, clientData.phoneWebsite,
              clientData.emailPrimary, clientData.emailSecondary, clientData.emailMarketing, clientData.emailWebsite, clientData.emailContact,
              clientData.websites, clientData.administrator, clientData.contactPerson, clientData.contactDate, clientData.dealId, clientData.observations,
              clientData.sourceFile, clientData.sourceSheet
            ]
          );
          imported++;
        } catch (err) {
          const errorMsg = `Error importing client ${clientData.companyName}: ${err instanceof Error ? err.message : String(err)}`;
          addLog(errorMsg, 'error');
          errors.push(errorMsg);
        }
      }
      addLog(`Completed processing ${filePath}: ${imported} imported so far`);
    } catch (err) {
      const errorMsg = `Error processing file ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      addLog(errorMsg, 'error');
      errors.push(errorMsg);
    }
  }
  
  addLog(`Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
  return { imported, skipped, errors, logs };
}

export async function getExcelFilesFromDirectory(directory: string): Promise<string[]> {
  const fs = await import('fs/promises');
  const files = await fs.readdir(directory);
  return files
    .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'))
    .map(file => path.join(directory, file));
}
