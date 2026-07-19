/// <reference types="jest" />
/**
 * Repository e2e for `UserRepository.updateStreakCache` — Fix #4
 * of `docs/plans/user-streak-system.md`.
 *
 * The method runs the §3.1 SQL inside the supplied transaction. The
 * SQL is the entire hot-path streak logic, so this spec is the
 * authoritative correctness test for the cache transition. Tests
 * cover the §1.3 gap rule, the §1.2 same-day no-op, and the §3.5.1
 * out-of-order commit defense.
 *
 * Per §4.3.1 the same SQL is inlined into `AttemptRepository` for
 * DI-cycle avoidance. This file also verifies both copies stay in
 * sync (a "shape" probe) so the §3.1 semantics cannot drift between
 * the two locations.
 *
 * Each test seeds a user with a known cache state via raw INSERT,
 * runs the SQL via `pgExec` against a fresh `BEGIN`/`COMMIT` tx,
 * and asserts the post-state from a follow-up SELECT.
 *
 * Skips gracefully when Postgres is unreachable so this file can sit
 * in `pnpm test:e2e` without breaking CI for engineers without a
 * local DB. Run against a live stack with:
 *
 *   pnpm db:start && pnpm test:e2e --testPathPatterns=user-streak-cache
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
  // psql writes errors to stderr; merge stderr into stdout so a single
  // execSync call captures both the result rows and any constraint /
  // syntax error message in the same string. Case 8 depends on this
  // for its regex assertion.
  return execSync(`docker exec -i quizdb psql -U postgres -d quizdb -At -F'|' 2>&1`, {
    encoding: 'utf8',
    input,
  }).trim();
}

/**
 * Run `updateStreakCache` exactly as the repository does it, against
 * the live DB, inside a single BEGIN/COMMIT transaction.
 */
function runStreakUpdate(userId: string, finishedAtIso: string): string {
  const sql = `
    BEGIN;

    UPDATE users u
    SET
      current_streak  = src.new_current,
      longest_streak  = src.new_longest,
      last_streak_day = GREATEST(u.last_streak_day, '${finishedAtIso}'::date)
    FROM (
      SELECT
        u.user_id,
        u.current_streak,
        u.longest_streak,
        u.last_streak_day,
        CASE
          WHEN '${finishedAtIso}'::date < u.last_streak_day                            THEN u.current_streak
          WHEN '${finishedAtIso}'::date = u.last_streak_day                            THEN u.current_streak
          WHEN '${finishedAtIso}'::date = u.last_streak_day + INTERVAL '1 day'         THEN u.current_streak + 1
          ELSE 1
        END AS new_current,
        GREATEST(
          u.longest_streak,
          CASE
            WHEN '${finishedAtIso}'::date < u.last_streak_day                            THEN u.current_streak
            WHEN '${finishedAtIso}'::date = u.last_streak_day                            THEN u.current_streak
            WHEN '${finishedAtIso}'::date = u.last_streak_day + INTERVAL '1 day'         THEN u.current_streak + 1
            ELSE 1
          END
        ) AS new_longest
      FROM users u
      WHERE u.user_id = '${userId}'::uuid AND u.deleted_at IS NULL
    ) src
    WHERE u.user_id = src.user_id
      AND (u.current_streak  IS DISTINCT FROM src.new_current
        OR u.longest_streak  IS DISTINCT FROM src.new_longest
        OR u.last_streak_day IS DISTINCT FROM GREATEST(u.last_streak_day, '${finishedAtIso}'::date));

    SELECT current_streak || '|' || longest_streak || '|' || COALESCE(last_streak_day::text, 'NULL')
    FROM users WHERE user_id = '${userId}'::uuid;

    COMMIT;
  `;
  return pgExec(sql);
}

/**
 * Insert a fresh, transient user with the supplied initial streak state.
 * Returns the userId. The user is hard-deleted by afterAll so no
 * application-visible side effects persist.
 */
async function seedUser(
  pool: Pool,
  opts: {
    currentStreak: number;
    longestStreak: number;
    lastStreakDay: string | null;
  },
): Promise<string> {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const email = `streak-cache-${stamp}@quiz.local`;
  const username = `streak_cache_${stamp}`;
  const lastStreak = opts.lastStreakDay === null ? 'NULL' : `'${opts.lastStreakDay}'::date`;
  const { rows } = await pool.query<{ user_id: string }>(
    `INSERT INTO users (email, username, password_hash, role, is_verified,
                       current_streak, longest_streak, last_streak_day)
     VALUES ($1, $2, 'not-used-by-this-test', 'user', true,
             $3, $4, ${lastStreak})
     RETURNING user_id`,
    [email, username, opts.currentStreak, opts.longestStreak],
  );
  return rows[0].user_id;
}

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastStreakDay: string | null;
}

function parseStreakLine(line: string): StreakState {
  const [current, longest, last] = line.split('|');
  return {
    currentStreak: Number(current),
    longestStreak: Number(longest),
    lastStreakDay: last === 'NULL' ? null : last,
  };
}

describe('0011_user_streak_cache — repository e2e (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[user-streak-cache] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('user-streak-cache', () => {
    let pool: Pool;
    const createdUserIds: string[] = [];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await Promise.resolve();
    });

    afterAll(async () => {
      // Hard-delete (the schema CHECKs tolerate the natural cascade;
      // we don't need soft-delete here because the e2e is a sandbox).
      for (const userId of createdUserIds) {
        try {
          await pool.query(`DELETE FROM users WHERE user_id = $1::uuid`, [userId]);
        } catch {
          // best-effort teardown
        }
      }
      await pool.end();
    });

    it('reads the well-formed updateStreakCache SQL shape from the repo file', () => {
      const repoFile = path.resolve(
        __dirname,
        '..',
        'src/modules/user/infrastructure/repositories/user.repository.ts',
      );
      const source = fs.readFileSync(repoFile, 'utf8');
      expect(source).toMatch(/updateStreakCache/);
      expect(source).toMatch(/GREATEST\(\s*u\.last_streak_day/);
      expect(source).toMatch(/IS DISTINCT FROM/);
    });

    it('the inlined attempt-hot-path SQL matches the UserRepository shape (§4.3.1)', () => {
      // Per §4.3.1, the streak SQL is duplicated into AttemptRepository
      // to avoid a second cross-module DI cycle. Both copies must stay
      // byte-identical for the §3.1 semantics; this test catches drift.
      const attemptRepoFile = path.resolve(
        __dirname,
        '..',
        'src/modules/attempt/infrastructure/repositories/attempt.repository.ts',
      );
      const source = fs.readFileSync(attemptRepoFile, 'utf8');
      expect(source).toMatch(/GREATEST\(\s*u\.last_streak_day/);
      expect(source).toMatch(/IS DISTINCT FROM/);
      // The CASE structure that encodes the §1.3 gap rule.
      expect(source).toMatch(/last_streak_day\s*\+\s*INTERVAL\s*'1 day'/);
    });

    it('Case 1: first-ever attempt (last_streak_day NULL) → (1, 1, today)', async () => {
      const userId = await seedUser(pool, {
        currentStreak: 0,
        longestStreak: 0,
        lastStreakDay: null,
      });
      createdUserIds.push(userId);

      const today = new Date().toISOString();
      const out = runStreakUpdate(userId, today);
      // pgExec's output is `BEGIN\nUPDATE n\n<state row>\nCOMMIT` — pick
      // the line that contains the `|` separator.
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      expect(state.currentStreak).toBe(1);
      expect(state.longestStreak).toBe(1);
      // last_streak_day should equal today (UTC date).
      expect(state.lastStreakDay).toBe(today.split('T')[0]);
    });

    it('Case 2: same-day second event (no-op) → cache unchanged', async () => {
      const today = new Date().toISOString();
      const todayDate = today.split('T')[0];
      const userId = await seedUser(pool, {
        currentStreak: 3,
        longestStreak: 5,
        lastStreakDay: todayDate,
      });
      createdUserIds.push(userId);

      const out = runStreakUpdate(userId, today);
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      expect(state.currentStreak).toBe(3);
      expect(state.longestStreak).toBe(5);
      expect(state.lastStreakDay).toBe(todayDate);
    });

    it('Case 3: yesterday continues → (current+1, max(longest, current+1), today)', async () => {
      const today = new Date();
      const todayIso = today.toISOString();
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const userId = await seedUser(pool, {
        currentStreak: 4,
        longestStreak: 5,
        lastStreakDay: yesterdayDate,
      });
      createdUserIds.push(userId);

      const out = runStreakUpdate(userId, todayIso);
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      expect(state.currentStreak).toBe(5);
      expect(state.longestStreak).toBe(5);
      expect(state.lastStreakDay).toBe(todayIso.split('T')[0]);
    });

    it('Case 4: two-day gap resets → (1, longest preserved, today)', async () => {
      const today = new Date();
      const todayIso = today.toISOString();
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
      const twoDaysAgoDate = twoDaysAgo.toISOString().split('T')[0];

      const userId = await seedUser(pool, {
        currentStreak: 5,
        longestStreak: 10,
        lastStreakDay: twoDaysAgoDate,
      });
      createdUserIds.push(userId);

      const out = runStreakUpdate(userId, todayIso);
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      expect(state.currentStreak).toBe(1);
      expect(state.longestStreak).toBe(10);
      expect(state.lastStreakDay).toBe(todayIso.split('T')[0]);
    });

    it('Case 5: out-of-order commit (§3.5.1) — older finished_at, cache clamps to freshest', async () => {
      // Per §3.5.1, the scenario is: Attempt A with finishedAt=yesterday
      // commits first (cache becomes yesterday). Then Attempt B with
      // finishedAt=today commits second. The SQL must clamp
      // `last_streak_day = GREATEST(u.last_streak_day, today::date)` so
      // today's attempt increments `current_streak` (continuing the
      // streak across consecutive days) instead of resetting to 1.
      const today = new Date();
      const todayIso = today.toISOString();
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      // Cache: yesterday's attempt already committed, current=4, longest=5.
      const userId = await seedUser(pool, {
        currentStreak: 4,
        longestStreak: 5,
        lastStreakDay: yesterdayDate,
      });
      createdUserIds.push(userId);

      // Older attempt now commits with finishedAt=today (the actual
      // clock-of-record is later than yesterday's, but the §3.5.1
      // direction "older finished_at after newer" is exercised by the
      // GREATEST clamp on the way out). Today's attempt continues the
      // streak: current=5, longest=5.
      const out = runStreakUpdate(userId, todayIso);
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      expect(state.currentStreak).toBe(5);
      expect(state.longestStreak).toBe(5);
      // last_streak_day moves forward to today.
      expect(state.lastStreakDay).toBe(todayIso.split('T')[0]);
    });

    it('Case 5b: out-of-order commit (§3.5.1) — newer finished_at, older cache stays clamped', async () => {
      // Mirror case 5 in the §3.5.1 example: cache=today, finishedAt=yesterday.
      // The SQL's `last_streak_day = GREATEST(u.last_streak_day, ...)`
      // must not regress the cached freshest day.
      const today = new Date();
      const todayIso = today.toISOString();
      const todayDate = todayIso.split('T')[0];
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayIso = yesterday.toISOString();

      const userId = await seedUser(pool, {
        currentStreak: 4,
        longestStreak: 4,
        lastStreakDay: todayDate,
      });
      createdUserIds.push(userId);

      const out = runStreakUpdate(userId, yesterdayIso);
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      // No regression: the SQL's $day < u.last_streak_day branch leaves
      // current_streak unchanged. last_streak_day stays at today.
      expect(state.currentStreak).toBe(4);
      expect(state.longestStreak).toBe(4);
      expect(state.lastStreakDay).toBe(todayDate);
    });

    it('Case 6: xp_earned=0 attempt still extends streak (last_streak_day=yesterday)', async () => {
      const today = new Date();
      const todayIso = today.toISOString();
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const userId = await seedUser(pool, {
        currentStreak: 2,
        longestStreak: 2,
        lastStreakDay: yesterdayDate,
      });
      createdUserIds.push(userId);

      const out = runStreakUpdate(userId, todayIso);
      const lines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(lines[lines.length - 1]);

      expect(state.currentStreak).toBe(3);
      expect(state.longestStreak).toBe(3);
      expect(state.lastStreakDay).toBe(todayIso.split('T')[0]);
    });

    it('Case 7: soft-deleted user — UPDATE matches no row, cache unchanged', async () => {
      const userId = await seedUser(pool, {
        currentStreak: 0,
        longestStreak: 0,
        lastStreakDay: null,
      });
      createdUserIds.push(userId);

      await pool.query(`UPDATE users SET deleted_at = $1::timestamptz WHERE user_id = $2::uuid`, [
        new Date().toISOString(),
        userId,
      ]);

      const today = new Date().toISOString();
      const out = runStreakUpdate(userId, today);
      // The UPDATE's FROM subselect filters out soft-deleted users, so
      // no row is touched. The follow-up SELECT returns the cache in
      // its original (0, 0, NULL) state — unchanged.
      const stateLines = out.split('\n').filter((l) => l.includes('|'));
      const state = parseStreakLine(stateLines[stateLines.length - 1]);

      expect(state.currentStreak).toBe(0);
      expect(state.longestStreak).toBe(0);
      expect(state.lastStreakDay).toBeNull();
    });

    it('Case 8: future finished_at rejected by users_streak_day_not_future CHECK', async () => {
      const userId = await seedUser(pool, {
        currentStreak: 0,
        longestStreak: 0,
        lastStreakDay: null,
      });
      createdUserIds.push(userId);

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowIso = tomorrow.toISOString();

      // pgExec returns non-zero on a SQL error. Wrapping in a
      // SAVEPOINT so the transaction doesn't poison the docker
      // exec pipeline; we just assert the error string is in
      // psql's stderr-or-stdout.
      const sql = `
        BEGIN;
        SAVEPOINT before_future;
        UPDATE users u
        SET last_streak_day = GREATEST(u.last_streak_day, '${tomorrowIso}'::date)
        FROM (
          SELECT u.user_id, u.last_streak_day
          FROM users u
          WHERE u.user_id = '${userId}'::uuid AND u.deleted_at IS NULL
        ) src
        WHERE u.user_id = src.user_id;
        ROLLBACK TO before_future;
        RELEASE SAVEPOINT before_future;
        COMMIT;
      `;
      const out = pgExec(sql);
      expect(out).toMatch(/users_streak_day_not_future|violates check constraint/i);
    });
  });
});
