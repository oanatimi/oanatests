import { Router, Request, Response } from 'express';
import path from 'path';
import { logger } from '../utils/logger';
import { config } from '../config';
import { importClientsFromExcel, getExcelFilesFromDirectory } from '../services/excelParser';

const router = Router();

// Import clients from Excel files in the data directory
router.post('/clients', async (req: Request, res: Response) => {
  try {
    // Use directory from request body, env var, or default to project root
    const dataDir = req.body.directory || config.excel.dataDirectory || path.resolve(__dirname, '../../../..');
    
    const excelFiles = await getExcelFilesFromDirectory(dataDir);
    
    if (excelFiles.length === 0) {
      res.status(404).json({ error: 'No Excel files found in directory' });
      return;
    }
    
    logger.info(`Found ${excelFiles.length} Excel files to import`);
    
    const result = await importClientsFromExcel(excelFiles);
    
    res.json({
      success: true,
      filesProcessed: excelFiles.length,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    logger.error(`Error importing clients: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to import clients' });
  }
});

export default router;
