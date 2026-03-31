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
  IRSDK_PATH: z.string().optional(),
  TELEMETRY_RATE: z.string().transform(Number).default('60'),
  ENABLE_VOICE_ALERTS: z.string().transform((v) => v === 'true').default('false'),
  // Remote iRacing connection
  IRACING_MODE: z.enum(['local', 'remote', 'mock']).default('mock'),
  IRACING_RELAY_HOST: z.string().optional(),
  IRACING_RELAY_PORT: z.string().transform(Number).default('3002'),
  CORS_ORIGIN: z.string().optional(),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  api: {
    port: env.API_PORT,
    host: '0.0.0.0',
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
    origin: env.NODE_ENV === 'production'
      ? (env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : ['http://localhost:3000'])
      : true,
  },
} as const;
