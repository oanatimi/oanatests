import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { config } from './index';

// Create a connection pool
const pool = new Pool({
  connectionString: config.database.url,
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

export default pool;
