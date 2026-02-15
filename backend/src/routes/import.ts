import { Router, Request, Response } from 'express';
import path from 'path';
import { config } from '../config';
import { importClientsFromExcel, getExcelFilesFromDirectory } from '../services/excelParser';
import { handleError, sendValidationError } from '../utils/errorHandler';

const router = Router();

// Import clients from Excel files in the data directory
router.post('/clients', async (req: Request, res: Response) => {
  try {
    // Determine base directory from config or default to project root
    const baseDir = config.excel.dataDirectory || path.resolve(__dirname, '../../../..');

    // Safely resolve and validate requested directory (if provided) against the base directory
    let dataDir = baseDir;
    if (typeof req.body.directory === 'string' && req.body.directory.trim() !== '') {
      const requestedDir = path.resolve(baseDir, req.body.directory);
      const relative = path.relative(baseDir, requestedDir);

      // Prevent directory traversal by ensuring the resolved path stays within baseDir
      // path.relative already normalizes the path, so '../' segments are resolved
      const normalizedRelative = path.normalize(relative);
      if (normalizedRelative.startsWith('..') || path.isAbsolute(normalizedRelative)) {
        sendValidationError(res, 'The specified directory path is invalid or not allowed.');
        return;
      }

      dataDir = requestedDir;
    }
    
    const excelFiles = await getExcelFilesFromDirectory(dataDir);
    
    if (excelFiles.length === 0) {
      sendValidationError(res, 'No Excel files (.xlsx) were found in the specified directory. Please check the path and try again.');
      return;
    }
    
    const result = await importClientsFromExcel(excelFiles);
    
    res.json({
      success: true,
      data: {
        filesProcessed: excelFiles.length,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      },
      message: `Import completed! ${result.imported} client(s) imported from ${excelFiles.length} file(s).${result.skipped > 0 ? ` ${result.skipped} duplicate(s) skipped.` : ''}${result.errors.length > 0 ? ` ${result.errors.length} error(s) encountered.` : ''}`,
    });
  } catch (error) {
    handleError(res, error, 'Error importing clients');
  }
});

export default router;
