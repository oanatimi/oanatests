/**
 * Database Migration Script
 * Runs the schema.sql file to create/update database tables
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('');
    console.error('For Railway deployment:');
    console.error('  1. Add a PostgreSQL database to your Railway project');
    console.error('  2. Link the DATABASE_URL variable from PostgreSQL to your backend service:');
    console.error('     - Go to your backend service in Railway dashboard');
    console.error('     - Click "Variables" tab');
    console.error('     - Click "Add Reference" or "New Variable"');
    console.error('     - Select the DATABASE_URL from your PostgreSQL service');
    console.error('');
    console.error('For local development:');
    console.error('  1. Copy .env.example to .env');
    console.error('  2. Set DATABASE_URL to your PostgreSQL connection string');
    console.error('     Example: DATABASE_URL=postgresql://postgres:password@localhost:5432/client_management');
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
