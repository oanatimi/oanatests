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
    // URL encode username and password to handle special characters
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${name}`;
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
  
  console.log('');
  console.log('=== DATABASE MIGRATION ===');
  console.log('Starting database migration...');
  // Log connection info (without password)
  try {
    const url = new URL(databaseUrl);
    console.log(`Connecting to: ${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`);
  } catch {
    console.log('Connecting to database...');
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  
  try {
    // Test connection first
    console.log('Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW() as server_time');
    console.log(`Connected successfully. Server time: ${connectionTest.rows[0].server_time}`);
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`Reading schema from: ${schemaPath}`);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    console.log('Executing database schema...');
    await pool.query(schema);
    
    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`Tables in database: ${tables.length > 0 ? tables.join(', ') : 'none'}`);
    
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('');
    console.error('=== DATABASE MIGRATION FAILED ===');
    console.error(`Error: ${error.message}`);
    if (error.code) {
      console.error(`PostgreSQL Error Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`Detail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`Hint: ${error.hint}`);
    }
    if (error.position) {
      console.error(`Position: ${error.position}`);
    }
    console.error('=================================');
    console.error('');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
