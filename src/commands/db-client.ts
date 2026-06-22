import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/core/database/schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run outbox operations');
}

// ─── Outbox CLI owns the pool and db lifecycle ─────────────────────────────────
// The outbox recovery CLI runs as a one-shot process; it needs
// its own pool because importing the seed `db-client` would
// also enforce the seed production-safety check
// (ALLOW_PROD_SEED), which is a separate concern from the
// outbox check (ALLOW_PROD_OUTBOX_OPERATIONS). Keeping the
// two entry points isolated avoids cross-talk between the
// safety checks.

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

export { db };

export const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is required to run outbox operations`);
  }
  return value;
};

export const closePool = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  await pool.end();
};
