import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import env from '../../config/env.config';

async function runMigrations() {
  let pool;
  try {
    // Initialize environment

    pool = new Pool({
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT),
      max: 20,
    });

    console.log('Running migrations...');
    await migrate(drizzle(pool), {
      migrationsFolder: 'src/database/migrations',
    });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

runMigrations();
