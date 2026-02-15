import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { config } from './index';

// Create a connection pool
const pool = new Pool({
  connectionString: config.database.url,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
});

// Log pool events
pool.on('connect', () => {
  logger.debug('Database pool: New client connected');
});

pool.on('error', (err) => {
  logger.error(`Database pool error: ${err.message}`);
});

// Helper function to execute queries
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query: ${text}`);
    logger.debug(`Duration: ${duration}ms`);
    return result.rows as T[];
  } catch (error) {
    logger.error(`Query error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper function to execute single-row queries
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

// Helper function to execute insert/update/delete with returning
export async function execute(text: string, params?: unknown[]): Promise<{ rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Execute: ${text}`);
    logger.debug(`Duration: ${duration}ms`);
    return { rowCount: result.rowCount || 0 };
  } catch (error) {
    logger.error(`Execute error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Get a client for transactions
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

// Shutdown pool gracefully
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

// Required tables for the application
const REQUIRED_TABLES = [
  'Client',
  'Message', 
  'MessageQueue',
  'MessageTemplate',
  'OptOut',
  'SystemConfig'
];

// Database schema constants
const DB_SCHEMA = 'public';
const TABLE_TYPE = 'BASE TABLE';

// Database health check result interface
export interface DatabaseHealthResult {
  connected: boolean;
  tablesExist: boolean;
  existingTables: string[];
  missingTables: string[];
  error?: string;
}

// Check database connectivity and verify all required tables exist
export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const result: DatabaseHealthResult = {
    connected: false,
    tablesExist: false,
    existingTables: [],
    missingTables: [],
  };

  try {
    // Test basic connectivity
    const connectivityTest = await pool.query('SELECT NOW() as current_time');
    result.connected = true;
    logger.info(`Database connection successful. Server time: ${connectivityTest.rows[0].current_time}`);

    // Query for existing tables in the schema
    const tablesQuery = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = $1 
       AND table_type = $2
       ORDER BY table_name`,
      [DB_SCHEMA, TABLE_TYPE]
    );

    const existingTableNames = tablesQuery.rows.map(row => row.table_name);
    result.existingTables = existingTableNames;

    // Use Set for O(1) lookups when checking required tables
    const existingTablesSet = new Set(existingTableNames);

    // Check for required tables
    for (const requiredTable of REQUIRED_TABLES) {
      if (existingTablesSet.has(requiredTable)) {
        logger.info(`✓ Table "${requiredTable}" exists`);
      } else {
        result.missingTables.push(requiredTable);
        logger.warn(`✗ Table "${requiredTable}" is MISSING`);
      }
    }

    result.tablesExist = result.missingTables.length === 0;

    if (result.tablesExist) {
      logger.info(`All ${REQUIRED_TABLES.length} required tables are present`);
    } else {
      logger.warn(`Missing ${result.missingTables.length} required tables: ${result.missingTables.join(', ')}`);
      logger.warn('Run database migrations with: npm run db:migrate');
    }

    // Log all tables found for debugging
    logger.info(`Database tables found: ${existingTableNames.length > 0 ? existingTableNames.join(', ') : 'none'}`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    logger.error(`Database health check failed: ${errorMessage}`);
    return result;
  }
}

export default pool;
