import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from '../utils/logger';
import env from './env.config';
import * as schema from '../models';

// Initialize pool with default config (will be properly initialized in initDatabaseConnection)
let pool = new Pool();

// Track if the pool is already closed
let isPoolClosed = false;

// Initialize Drizzle with the connection pool
export const db = drizzle(pool, { schema });

// Function to initialize database connection with proper config
export const initDatabaseConnection = async (): Promise<void> => {
  try {
    // Create pool with loaded environment variables
    const newPool = new Pool({
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT ?? '5432'),
      max: 20,
      ssl: env.DB_SSL_ENABLED
        ? {
            rejectUnauthorized: false,
          }
        : false,
    });

    // If there was a previous pool, end it
    if (pool && !isPoolClosed) {
      try {
        await pool.end();
      } catch (error) {
        logger.warn('Error ending previous pool:', error);
      }
    }

    // Update the pool reference
    pool = newPool;

    // Reinitialize drizzle with the new pool
    Object.assign(db, drizzle(pool, { schema }));

    logger.info('✅ Database connection initialized with environment configuration');
  } catch (error) {
    logger.error('❌ Failed to initialize database connection:', error);
    throw error;
  }
};

// Function to test database connection
export const testConnection = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    logger.info('✅ PostgreSQL connected successfully');
    client.release();
  } catch (err: unknown) {
    logger.error(
      `❌ PostgreSQL connection error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
};

// For explicitly closing the pool when the application shutdowns
export const closePool = async (): Promise<void> => {
  if (!isPoolClosed) {
    isPoolClosed = true;
    await pool.end();
    logger.info('✅ Database connection pool closed');
  }
};
