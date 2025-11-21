import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local if it exists (try multiple locations)
const envPaths = [
  resolve(process.cwd(), '.env.local'),          // apps/api/.env.local
  resolve(process.cwd(), '../../.env.local'),    // Root .env.local (from apps/api)
  resolve(__dirname, '../../../.env.local'),     // Root .env.local (from src)
];

for (const envPath of envPaths) {
  try {
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach((line) => {
      const match = line.match(/^([^=:#]+?)[=:](.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log(`[Config] Loaded environment from: ${envPath}`);
    break; // Stop after first successful load
  } catch {
    // Try next path
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.string().transform(Number).default('3000'),
  SOCKET_PORT: z.string().transform(Number).default('3001'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/race_engineer'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  IRSDK_PATH: z.string().optional(),
  TELEMETRY_RATE: z.string().transform(Number).default('60'),
  ENABLE_VOICE_ALERTS: z.string().transform((v) => v === 'true').default('false'),
  // Remote iRacing connection
  IRACING_MODE: z.enum(['local', 'remote', 'mock']).default('mock'),
  IRACING_RELAY_HOST: z.string().optional(),
  IRACING_RELAY_PORT: z.string().transform(Number).default('3002'),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  api: {
    port: env.API_PORT,
    host: '0.0.0.0',
  },
  socket: {
    port: env.SOCKET_PORT,
  },
  DATABASE_URL: env.DATABASE_URL,
  REDIS_URL: env.REDIS_URL,
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  telemetry: {
    rate: env.TELEMETRY_RATE,
    irsdkPath: env.IRSDK_PATH,
    mode: env.IRACING_MODE,
  },
  iracing: {
    mode: env.IRACING_MODE,
    relayHost: env.IRACING_RELAY_HOST,
    relayPort: env.IRACING_RELAY_PORT,
  },
  features: {
    voiceAlerts: env.ENABLE_VOICE_ALERTS,
  },
  cors: {
    origin: env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : true,
  },
} as const;
