import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env.local
dotenv.config({ path: resolve(process.cwd(), '../../.env.local') });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/race_engineer',
  },
  verbose: true,
  strict: true,
} satisfies Config;
