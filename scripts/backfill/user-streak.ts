/* eslint-disable @typescript-eslint/no-unsafe-assignment --
 * `db.execute(sql\`...\`)` returns the pg driver's `any`-typed result
 * wrapper; the row shape is asserted via the `<T extends Record<...>>`
 * generic and the `.rows as { rows: T[] }` cast. Same pattern used by
 * `UserRepository.updateStreakCache` and the attempt repository's
 * `completeAttemptAndSideEffects`. Operational scripts are not in the
 * hot path of the linter's strictness budget.
 */

/**
 * Operational backfill for `users.current_streak` /
 * `users.longest_streak` / `users.last_streak_day`.
 *
 * Run with:
 *   pnpm db:backfill:user-streak              # backfill every active user
 *   pnpm db:backfill:user-streak --dry-run    # compute + log, write nothing
 *   pnpm db:backfill:user-streak --user-id=<uuid>  # single user
 *
 * Output (stdout): a JSON summary at the end of the run:
 *   { "usersEvaluated": 1234, "usersUpdated": 7, "unchanged": 1227,
 *     "maxStreakSeen": 412, "errorCount": 0 }
 *
 * Idempotency (§6.3): the §3.1 SQL's `IS DISTINCT FROM` guard means
 * a re-run writes zero rows for already-correct caches. Safe to
 * retry on transient failures — the cursor is `user_id` so a
 * partially-completed run resumes cleanly when re-invoked.
 *
 * Production safety: the script refuses to run in production unless
 * `ALLOW_PROD_USER_STREAK_BACKFILL=true`. Streak backfill is a
 * non-destructive cache repopulation, but a bug in the recompute
 * logic could under-write `longest_streak` across millions of users
 * before the operator notices.
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/core/database/schema';
import { computeBackfillTrio, type UtcDayString, type StreakTrio } from './user-streak.algorithm';

// =============================================================================
// Database bootstrap — owned by this script, not by the seed infra.
//
// Rationale: the seed infra (`src/commands/seed/infrastructure/db-client.ts`)
// refuses to load in production unless `ALLOW_PROD_SEED=true`. That guard
// is appropriate for the seed orchestrator (a developer convenience) but
// would block this backfill from running in production even when the
// operator has explicitly opted in via `ALLOW_PROD_USER_STREAK_BACKFILL`.
// Owning our own pool keeps the two safety gates independent.
// =============================================================================

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

const databaseUrl = requireEnv('DATABASE_URL');
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

async function closePool(): Promise<void> {
  await pool.end();
}

// =============================================================================
// CLI parsing
// =============================================================================

interface CliFlags {
  dryRun: boolean;
  userId: string | null;
  limit: number | null;
  help: boolean;
}

function parseCli(argv: readonly string[]): CliFlags {
  const flags: CliFlags = {
    dryRun: false,
    userId: null,
    limit: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) break;
    if (arg === '--dry-run') {
      flags.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }
    if (arg.startsWith('--user-id=')) {
      flags.userId = arg.slice('--user-id='.length);
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length));
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--limit must be a positive integer (got: ${arg})`);
      }
      flags.limit = n;
      continue;
    }
    throw new Error(`Unknown flag: ${arg} (try --help)`);
  }
  return flags;
}

function usage(): void {
  console.log(`Usage:
  pnpm db:backfill:user-streak                # backfill every active user
  pnpm db:backfill:user-streak --dry-run      # compute + log, write nothing
  pnpm db:backfill:user-streak --user-id=<uuid>   # backfill a single user
  pnpm db:backfill:user-streak --limit=<n>    # cap user cursor for staging smoke-tests

Backfills users.current_streak / longest_streak / last_streak_day from
quiz_attempts rows with status='completed'.

Environment:
  DATABASE_URL                                Postgres connection string (required).
  ALLOW_PROD_USER_STREAK_BACKFILL=true        Required to run in production.
  NODE_ENV=production                         Implies the safety check above.

Per §6.3 the script is idempotent — re-running writes zero rows for already-correct caches.
`);
}

// =============================================================================
// Production safety
// =============================================================================

function refuseInProduction(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PROD_USER_STREAK_BACKFILL !== 'true'
  ) {
    throw new Error(
      'Refusing to run user-streak backfill in production. Set ALLOW_PROD_USER_STREAK_BACKFILL=true to override.',
    );
  }
}

// =============================================================================
// DB queries
// =============================================================================

interface UserCursorRow extends Record<string, unknown> {
  user_id: string;
}

async function listActiveUserIds(limit: number | null): Promise<string[]> {
  // The cursor is `user_id` (UUID, stable, no NULLs) — a `LIMIT`/`OFFSET`
  // pagination is fine for the backfill's current user base. Per §3.2
  // parallelisation across users is a future optimisation; serial is
  // sufficient here.
  const whereClause = sql`deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM quiz_attempts
    WHERE quiz_attempts.user_id = users.user_id
      AND quiz_attempts.status = 'completed'
      AND quiz_attempts.finished_at IS NOT NULL
  )`;
  const baseQuery = db
    .select({ user_id: sql<string>`user_id` })
    .from(sql`users`)
    .where(whereClause)
    .orderBy(sql`user_id`);
  const rows = limit === null ? await baseQuery : await baseQuery.limit(limit);
  return rows.map((r) => r.user_id);
}

interface CompletionDayRow extends Record<string, unknown> {
  day: UtcDayString;
}

interface TodayRow extends Record<string, unknown> {
  today: UtcDayString;
}

async function fetchDistinctCompletionDays(userId: string): Promise<UtcDayString[]> {
  // Per §3.2: DISTINCT (finished_at AT TIME ZONE 'UTC')::date, no LIMIT.
  // The cast pins the day boundary to UTC regardless of host session tz.
  const result = await db.execute<CompletionDayRow>(sql`
    SELECT DISTINCT (finished_at AT TIME ZONE 'UTC')::date::text AS day
    FROM quiz_attempts
    WHERE user_id = ${userId}::uuid
      AND status = 'completed'
      AND finished_at IS NOT NULL
    ORDER BY day DESC
  `);
  const rows = (result as unknown as { rows: CompletionDayRow[] }).rows;
  return rows.map((r) => r.day);
}

// =============================================================================
// Writer — the §3.1 SQL, copied verbatim so the two copies stay in sync.
// =============================================================================

async function writeStreakCache(userId: string, trio: StreakTrio): Promise<boolean> {
  // `IS DISTINCT FROM` makes this a no-op when the recompute produces
  // the same values (idempotency, §6.3). The script reads the RETURNING
  // row count to know whether anything actually changed.
  const result = await db.execute<UserCursorRow>(sql`
    UPDATE users u
    SET
      current_streak  = ${trio.currentStreak},
      longest_streak  = ${trio.longestStreak},
      last_streak_day = ${trio.lastStreakDay}::date
    WHERE u.user_id = ${userId}::uuid
      AND u.deleted_at IS NULL
      AND (u.current_streak  IS DISTINCT FROM ${trio.currentStreak}
        OR u.longest_streak  IS DISTINCT FROM ${trio.longestStreak}
        OR u.last_streak_day IS DISTINCT FROM ${trio.lastStreakDay}::date)
    RETURNING u.user_id
  `);
  const rows = (result as unknown as { rows: UserCursorRow[] }).rows;
  return rows.length > 0;
}

// =============================================================================
// Main
// =============================================================================

interface RunSummary {
  usersEvaluated: number;
  usersUpdated: number;
  unchanged: number;
  maxStreakSeen: number;
  errorCount: number;
  dryRun: boolean;
}

async function backfillOneUser(
  userId: string,
  today: UtcDayString,
  dryRun: boolean,
): Promise<{ updated: boolean; maxStreak: number }> {
  const days = await fetchDistinctCompletionDays(userId);
  const trio = computeBackfillTrio({ days, today });
  if (dryRun) {
    return { updated: false, maxStreak: trio.longestStreak };
  }
  const updated = await writeStreakCache(userId, trio);
  return { updated, maxStreak: trio.longestStreak };
}

async function main(): Promise<void> {
  const flags = parseCli(process.argv.slice(2));
  if (flags.help) {
    usage();
    return;
  }
  // DATABASE_URL is enforced at module load above. The production-safety
  // gate runs regardless of --help-vs-not: --help is checked first so
  // a curious operator in production never accidentally trips the
  // prod refusal. (`refuseInProduction` short-circuits only on
  // `NODE_ENV=production`; local/dev usage is unaffected.)
  refuseInProduction();

  // Pin `today` to the SQL server's UTC date. The DB is the source of
  // truth for `current_date` — if the application server and DB drift
  // by a few hours, the script uses the DB's clock so all operators
  // see the same "today".
  const todayRows = await db.execute<TodayRow>(sql`
    SELECT (now() AT TIME ZONE 'UTC')::date::text AS today
  `);
  const todayRowsArr = (todayRows as unknown as { rows: TodayRow[] }).rows;
  const firstRow = todayRowsArr[0];
  if (firstRow === undefined) {
    throw new Error('Backfill: failed to read today from the database');
  }
  const today = firstRow.today;

  console.log(
    `[user-streak-backfill] starting at ${new Date().toISOString()} (today=${today}, dryRun=${flags.dryRun})`,
  );

  let usersEvaluated = 0;
  let usersUpdated = 0;
  let unchanged = 0;
  let maxStreakSeen = 0;
  let errorCount = 0;

  if (flags.userId !== null) {
    // Single-user path — bypass the cursor, useful for staging smoke
    // tests and for re-running after a partial failure.
    usersEvaluated = 1;
    try {
      const { updated, maxStreak } = await backfillOneUser(flags.userId, today, flags.dryRun);
      if (updated) usersUpdated += 1;
      else unchanged += 1;
      if (maxStreak > maxStreakSeen) maxStreakSeen = maxStreak;
      console.log(
        `[user-streak-backfill] ${flags.userId}: ${updated ? 'updated' : 'unchanged'} (longest=${maxStreak})${flags.dryRun ? ' [dry-run]' : ''}`,
      );
    } catch (err) {
      errorCount += 1;
      console.error(
        `[user-streak-backfill] ${flags.userId}: error ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    // Multi-user cursor.
    const userIds = await listActiveUserIds(flags.limit);
    console.log(`[user-streak-backfill] ${userIds.length} user(s) to evaluate`);

    for (const userId of userIds) {
      usersEvaluated += 1;
      try {
        const { updated, maxStreak } = await backfillOneUser(userId, today, flags.dryRun);
        if (updated) usersUpdated += 1;
        else unchanged += 1;
        if (maxStreak > maxStreakSeen) maxStreakSeen = maxStreak;
      } catch (err) {
        errorCount += 1;
        console.error(
          `[user-streak-backfill] ${userId}: error ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      // Periodic progress so an hour-long run is not silent.
      if (usersEvaluated % 100 === 0) {
        console.log(
          `[user-streak-backfill] progress: evaluated=${usersEvaluated} updated=${usersUpdated} unchanged=${unchanged} errors=${errorCount}`,
        );
      }
    }
  }

  const summary: RunSummary = {
    usersEvaluated,
    usersUpdated,
    unchanged,
    maxStreakSeen,
    errorCount,
    dryRun: flags.dryRun,
  };
  // §6.2 requires this exact JSON shape on stdout.
  console.log(`[user-streak-backfill] summary: ${JSON.stringify(summary)}`);
}

main()
  .catch((err) => {
    console.error(
      '[user-streak-backfill] failed:',
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
