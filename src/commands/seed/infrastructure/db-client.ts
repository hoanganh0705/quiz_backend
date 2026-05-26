import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/core/database/schema';
import * as relations from '@/core/database/schema/relations';

const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const allowProdSeed = process.env.ALLOW_PROD_SEED === 'true';

if (isProduction && !allowProdSeed) {
  throw new Error('Refusing to run seed in production. Set ALLOW_PROD_SEED=true to override.');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run seeds');
}

// ─── Entry point owns the pool and db lifecycle ─────────────────────────────────
// Seed modules import this entry-point's db instance rather than creating their own.
// This ensures the pool is only created once and closed exactly once.

const pool = new Pool({ connectionString: databaseUrl });
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const db = drizzle(pool, { schema: { ...schema, ...relations } });

export { db };

export const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is required to run seeds`);
  }
  return value;
};

export const closePool = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  await pool.end();
};
