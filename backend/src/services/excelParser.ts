import ExcelJS from 'exceljs';
import path from 'path';
import { logger } from '../utils/logger';
import prisma from '../config/database';

interface ClientData {
  companyName: string;
  status?: string;
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
  observations?: string;
  sourceFile?: string;
  sourceSheet?: string;
}

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
};

// Column mapping for "baza date lorand.xlsx"
const COLUMN_MAPPING_LORAND: Record<string, keyof ClientData> = {
  'Firma': 'companyName',
  'Judet': 'county',
  'Nr de telefon': 'phonePrimary',
  'Observatii': 'observations',
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
  const str = String(value).trim();
  return str === '' ? undefined : str;
}

function normalizePhoneNumber(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  // Handle Romanian phone numbers
  if (normalized.startsWith('0')) {
    normalized = '+40' + normalized.substring(1);
  } else if (!normalized.startsWith('+')) {
    normalized = '+40' + normalized;
  }
  return normalized;
}

async function parseExcelFile(filePath: string): Promise<ClientData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const fileName = path.basename(filePath);
  const clients: ClientData[] = [];
  const isLorandFile = fileName.toLowerCase().includes('lorand');
  const columnMapping = isLorandFile ? COLUMN_MAPPING_LORAND : COLUMN_MAPPING_2023;
  
  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    
    // Skip empty or irrelevant sheets
    if (worksheet.rowCount < 2) continue;
    if (sheetName.toLowerCase().includes('aaa')) continue;
    
    // Get header row
    const headerRow = worksheet.getRow(1);
    const columnIndices: Record<string, number> = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const header = cleanString(cell.value);
      if (header && columnMapping[header]) {
        columnIndices[columnMapping[header]] = colNumber;
      }
    });
    
    // Check if we have essential columns
    if (!columnIndices['companyName'] && !columnIndices['phonePrimary']) {
      logger.warn(`Skipping sheet "${sheetName}" - no essential columns found`);
      continue;
    }
    
    // Parse data rows
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
      
      const client: ClientData = {
        companyName: cleanString(companyNameCell) || 'Unknown Company',
        sourceFile: fileName,
        sourceSheet: sheetName,
      };
      
      // Map all columns
      for (const [field, colIndex] of Object.entries(columnIndices)) {
        const cellValue = row.getCell(colIndex).value;
        
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
          default:
            (client as unknown as Record<string, string | undefined>)[field] = cleanString(cellValue);
        }
      }
      
      clients.push(client);
    }
    
    logger.info(`Parsed ${clients.length} clients from sheet "${sheetName}" in file "${fileName}"`);
  }
  
  return clients;
}

export async function importClientsFromExcel(filePaths: string[]): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  for (const filePath of filePaths) {
    try {
      logger.info(`Processing file: ${filePath}`);
      const clients = await parseExcelFile(filePath);
      
      for (const clientData of clients) {
        try {
          // Check for duplicates based on company name and primary phone
          const existingClient = await prisma.client.findFirst({
            where: {
              OR: [
                { companyName: clientData.companyName, phonePrimary: clientData.phonePrimary },
                { cui: clientData.cui ? clientData.cui : undefined },
              ].filter(Boolean),
            },
          });
          
          if (existingClient) {
            skipped++;
            continue;
          }
          
          await prisma.client.create({
            data: clientData,
          });
          imported++;
        } catch (err) {
          const errorMsg = `Error importing client ${clientData.companyName}: ${err instanceof Error ? err.message : String(err)}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = `Error processing file ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  logger.info(`Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
  return { imported, skipped, errors };
}

export async function getExcelFilesFromDirectory(directory: string): Promise<string[]> {
  const fs = await import('fs/promises');
  const files = await fs.readdir(directory);
  return files
    .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'))
    .map(file => path.join(directory, file));
}
