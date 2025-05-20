import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define environment variable schema with validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_PREFIX: z.string().default('/api/v1'),

  // Database
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOST: z.string(),
  DB_PORT: z.string(),
  DB_SSL_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('86400'),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('10'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_DB: z.string().default('0'),

  // Sync
  SYNC_INTERVAL_HOURS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('6'),

  // Rate Limiting
  RATE_LIMIT_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX: z.string().default('5'),
  // Test Rate Limiting
  TEST_RATE_LIMIT_WINDOW_MS: z.string().default('1000'),
  TEST_RATE_LIMIT_MAX: z.string().default('3'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_FILE_PATH: z.string().default('logs/app.log'),

  // Encryption
  ENCRYPTION_KEY: z.string().default('default-encryption-key-change-in-production'),
  ENCRYPTION_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
});

// Parse and validate environment variables
let parsedEnv;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  console.error('Error parsing environment variables:', error);
  process.exit(1);
}

// Export the validated environment variables
const env = parsedEnv;
export default env;
