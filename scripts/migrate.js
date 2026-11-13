require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    const baseSchema = await client.query("SELECT to_regclass('public.student') AS table_name");
    if (!baseSchema.rows[0].table_name) {
      const baseSchemaSql = fs.readFileSync(path.join(__dirname, '..', 'hostel_schema.sql'), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(baseSchemaSql);
        await client.query('COMMIT');
        console.log('Applied base hostel schema');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migration (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationDirectory = path.join(__dirname, 'migrations');
    const migrations = fs.readdirSync(migrationDirectory)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    const appliedResult = await client.query('SELECT migration_name FROM schema_migration');
    const applied = new Set(appliedResult.rows.map((row) => row.migration_name));

    for (const migrationName of migrations) {
      if (applied.has(migrationName)) continue;
      const sql = fs.readFileSync(path.join(migrationDirectory, migrationName), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migration (migration_name) VALUES ($1)', [migrationName]);
        await client.query('COMMIT');
        console.log(`Applied ${migrationName}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Database migration failed:', error.message || error);
  process.exitCode = 1;
});
