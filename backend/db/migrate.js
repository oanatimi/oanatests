/**
 * Database Migration Script
 * Runs the schema.sql file to create/update database tables
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Get database URL from DATABASE_URL or individual variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 */
function getDatabaseUrl() {
  // If DATABASE_URL is provided, use it directly
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return databaseUrl;
  }
  
  // Otherwise, construct from individual variables (Railway Postgres references)
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  
  if (host && name && user && password) {
    return `postgresql://${user}:${password}@${host}:${port}/${name}`;
  }
  
  return null;
}

async function migrate() {
  const databaseUrl = getDatabaseUrl();
  
  if (!databaseUrl) {
    console.error('ERROR: Database connection not configured');
    console.error('');
    console.error('For Railway deployment:');
    console.error('  1. Add a PostgreSQL database to your Railway project');
    console.error('  2. The following variables will be auto-linked from Postgres service:');
    console.error('     - DATABASE_URL (connection string)');
    console.error('     - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (individual variables)');
    console.error('');
    console.error('For local development:');
    console.error('  1. Copy .env.example to .env');
    console.error('  2. Set DATABASE_URL to your PostgreSQL connection string');
    console.error('     Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/client_management');
    console.error('  Or set individual variables:');
    console.error('     DB_HOST=localhost');
    console.error('     DB_PORT=5432');
    console.error('     DB_NAME=client_management');
    console.error('     DB_USER=postgres');
    console.error('     DB_PASSWORD=password');
    process.exit(1);
  }
  
  console.log('Starting database migration...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Database migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
