import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { messageQueueService } from './services/messageQueueService';
import { checkDatabaseHealth, DatabaseHealthResult } from './config/database';

import clientRoutes from './routes/clients';
import messageRoutes from './routes/messages';
import importRoutes from './routes/import';

// Store database health status for health endpoint
let databaseHealth: DatabaseHealthResult | null = null;

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting for API - configurable via env vars
const apiLimiter = rateLimit({
  windowMs: config.rateLimits.apiRateLimitWindowMinutes * 60 * 1000,
  max: config.rateLimits.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check with database status
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: databaseHealth ? {
      connected: databaseHealth.connected,
      tablesExist: databaseHealth.tablesExist,
      missingTables: databaseHealth.missingTables,
    } : { status: 'not_checked' }
  });
});

// API routes
app.use('/api/clients', clientRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/import', importRoutes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.port;

// Async initialization function to handle database health check and start services
async function initializeServices(): Promise<void> {
  try {
    // Check database health before starting dependent services
    logger.info('Checking database health...');
    databaseHealth = await checkDatabaseHealth();
    
    if (databaseHealth.connected) {
      if (databaseHealth.tablesExist) {
        // All tables exist - start message queue processor
        logger.info('Database ready - starting message queue processor');
        messageQueueService.start();
      } else {
        // Tables missing - warn but don't crash
        logger.warn('Database tables missing - message queue processor will NOT start');
        logger.warn('Please run migrations: npm run db:migrate');
      }
    } else {
      logger.error('Database connection failed - message queue processor will NOT start');
      logger.error(`Error: ${databaseHealth.error}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Service initialization failed: ${errorMessage}`);
  }
}

// Bind to 0.0.0.0 for Docker/Railway compatibility (required for container networking)
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  
  // Initialize services asynchronously with proper error handling
  initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  messageQueueService.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  messageQueueService.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
