/// <reference types="jest" />
/**
 * Migration e2e for `0011_add_users_last_streak_day.sql` — Fix #4
 * of `docs/plans/user-streak-system.md`.
 *
 * Verifies that the migration in
 * `src/core/database/migrations/0011_add_users_last_streak_day.sql`:
 *   - adds the `users.last_streak_day` column (idempotent via
 *     `ADD COLUMN IF NOT EXISTS`)
 *   - adds the `users_streak_day_not_future` CHECK constraint
 *   - is itself idempotent at the SQL level
 *
 * Skips gracefully when Postgres is unreachable so this file can sit
 * in `pnpm test:e2e` without breaking CI for engineers without a
 * local DB. Run against a live stack with:
 *
 *   pnpm db:start && pnpm test:e2e --testPathPatterns=add-users-last-streak-day
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal `.env` loader (mirrors test/drop-users-xp-total.e2e-spec.ts).
// ---------------------------------------------------------------------------
function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    let inSingle = false;
    let inDouble = false;
    let hashIdx = -1;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === '#' && !inSingle && !inDouble) {
        hashIdx = i;
        break;
      }
    }
    if (hashIdx >= 0) trimmed = trimmed.slice(0, hashIdx).trim();
    if (!trimmed) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadDotEnv();

import { Pool } from 'pg';
import { execSync } from 'node:child_process';

function pgExec(input: string): string {
  return execSync(`docker exec -i quizdb psql -U postgres -d quizdb -At -F'|'`, {
    encoding: 'utf8',
    input,
  }).trim();
}

function readMigrationSql(): string {
  const file = path.resolve(
    __dirname,
    '..',
    'src/core/database/migrations/0011_add_users_last_streak_day.sql',
  );
  return fs.readFileSync(file, 'utf8');
}

describe('0011_add_users_last_streak_day — migration e2e (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[add-users-last-streak-day] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('add-users-last-streak-day', () => {
    let pool: Pool;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await Promise.resolve();
    });

    afterAll(async () => {
      await pool.end();
    });

    it('reads well-formed migration SQL from disk', () => {
      const sqlText = readMigrationSql();
      expect(sqlText).toMatch(/ALTER\s+TABLE\s+users\s+ADD\s+COLUMN/i);
      expect(sqlText).toMatch(/last_streak_day/i);
      // The migration uses raw SQL `ADD COLUMN ... DATE` (no drizzle
      // `type:` prefix); the regex accepts either form.
      expect(sqlText).toMatch(/last_streak_day[^,\n]*DATE|type:\s*date/i);
      expect(sqlText).toMatch(/users_streak_day_not_future/i);
    });

    it('migration is idempotent at the SQL level: ADD COLUMN IF NOT EXISTS lets it re-run safely', () => {
      const sqlText = readMigrationSql();
      expect(sqlText).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
    });

    it('after running the migration, the last_streak_day column exists on users', async () => {
      const { rows: colRows } = await pool.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'users'
           AND column_name  = 'last_streak_day'`,
      );
      const columnExistsBefore = colRows.length > 0;

      if (!columnExistsBefore) {
        pgExec(readMigrationSql());
      }

      const after = await pool.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'users'
           AND column_name  = 'last_streak_day'`,
      );
      expect(after.rows.length).toBe(1);
    });

    it('the last_streak_day column is nullable (no NOT NULL constraint)', async () => {
      const { rows } = await pool.query<{ is_nullable: string }>(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'users'
           AND column_name  = 'last_streak_day'`,
      );
      expect(rows[0]?.is_nullable).toBe('YES');
    });

    it('after running the migration, the users_streak_day_not_future CHECK constraint exists', async () => {
      const { rows } = await pool.query<{ constraint_name: string }>(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_schema   = 'public'
           AND table_name     = 'users'
           AND constraint_name = 'users_streak_day_not_future'`,
      );

      if (rows.length === 0) {
        pgExec(readMigrationSql());
      }

      const after = await pool.query<{ constraint_name: string }>(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_schema   = 'public'
           AND table_name     = 'users'
           AND constraint_name = 'users_streak_day_not_future'`,
      );
      expect(after.rows.length).toBe(1);
    });

    it('the existing users_streak_nonneg and users_streak_order CHECK constraints are preserved', async () => {
      const { rows } = await pool.query<{ constraint_name: string }>(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_schema   = 'public'
           AND table_name     = 'users'
           AND constraint_name IN ('users_streak_nonneg', 'users_streak_order')`,
      );
      const names = rows.map((r) => r.constraint_name).sort();
      expect(names).toEqual(['users_streak_nonneg', 'users_streak_order']);
    });
  });
});
