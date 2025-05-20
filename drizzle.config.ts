import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/models',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: String(process.env.DB_HOST),
    user: String(process.env.DB_USER),
    password: String(process.env.DB_PASSWORD),
    database: String(process.env.DB_NAME),
    port: parseInt(String(process.env.DB_PORT)),
    ssl: false,
  },
  verbose: true,
  strict: false,
} satisfies Config;
