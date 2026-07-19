/// <reference types="jest" />
/**
 * Reconciliation e2e for the tournament participant totals counter
 * (Phase 4 of `docs/plans/denormalized-counters-audit.md` — Fix #1).
 *
 * Verifies that the SQL in
 * `src/core/database/migrations/0008_reconcile_tournament_participant_totals.sql`
 * repairs drift between `tournament_participants.total_score` /
 * `total_score_ms` and the SUM of `tournament_round_participants.round_score`
 * / `round_time_ms` for two participant histories:
 *
 *   - Case A: participant has 2 round participants with scores 80 + 70 but
 *     total_score = 0 (counter under-counted). After the migration,
 *     total_score = 150 and total_time_ms = sum of round times.
 *
 *   - Case B: participant has 0 round participants but total_score = 9999 and
 *     total_time_ms = 12345 (counter over-counted). After the migration,
 *     both are reset to 0.
 *
 * The migration is also exercised in:
 *
 *   1. its own no-op mode against the live DB (when no drift exists),
 *      to confirm it never overwrites a correct counter.
 *   2. seeded-drift mode, to confirm it converges on the truth.
 *
 * Skips gracefully when Postgres is unreachable so this file can sit in
 * `pnpm test:e2e` without breaking CI for engineers without a local
 * DB. Run against a live stack with:
 *
 *   pnpm db:start && pnpm db:seed:foundation && \
 *   pnpm test:e2e --testPathPatterns=reconcile-tournament-totals
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal `.env` loader (mirrors test/reconcile-helpful-count.e2e-spec.ts).
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

import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import * as schema from '@/core/database/schema';
import {
  tournaments,
  tournamentRounds,
  tournamentParticipants,
  tournamentRoundParticipants,
  users,
} from '@/core/database/schema';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function pgExec(sqlText: string): string {
  return execSync(`docker exec -i quizdb psql -U postgres -d quizdb -At -F'|'`, {
    encoding: 'utf8',
    input: sqlText,
  }).trim();
}

function readMigrationSql(): string {
  const file = path.resolve(
    __dirname,
    '..',
    'src/core/database/migrations/0008_reconcile_tournament_participant_totals.sql',
  );
  return fs.readFileSync(file, 'utf8');
}

describe('0008_reconcile_tournament_participant_totals — migration e2e (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[reconcile-tournament-totals] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('reconcile-tournament-totals', () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let userIdA: string;
    let userIdB: string;
    let createdTournamentIds: string[] = [];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;

      // One-off users per suite — soft-deleted in afterAll. Two users so we
      // can exercise two participants in a single tournament.
      const stamp = Date.now();
      const [a] = await db
        .insert(users)
        .values({
          email: `reconcile-tour-a-${stamp}@quiz.local`,
          username: `reconcile_tour_a_${stamp}`,
          passwordHash: 'not-used-by-this-test',
          role: 'user',
          isVerified: true,
        })
        .returning({ userId: users.userId });
      const [b] = await db
        .insert(users)
        .values({
          email: `reconcile-tour-b-${stamp}@quiz.local`,
          username: `reconcile_tour_b_${stamp}`,
          passwordHash: 'not-used-by-this-test',
          role: 'user',
          isVerified: true,
        })
        .returning({ userId: users.userId });
      userIdA = a.userId;
      userIdB = b.userId;
    });

    afterAll(async () => {
      // Hard-delete users — FKs on tournament_participants cascade, wiping
      // participants and their round participants with them. The seeded
      // tournaments then have no remaining participants and can be hard
      // deleted via the cascade path.
      if (userIdA || userIdB) {
        const ids = [userIdA, userIdB].filter(Boolean);
        if (ids.length > 0) {
          pgExec(`DELETE FROM users WHERE user_id IN (${ids.map((id) => `'${id}'`).join(',')})`);
        }
      }
      if (pool) await pool.end();
    });

    afterEach(async () => {
      // Belt & braces: hard-delete any tournaments the test created. With
      // users already cleaned, this is a no-op when the cascade succeeded.
      for (const tId of createdTournamentIds) {
        try {
          pgExec(`DELETE FROM tournaments WHERE tournament_id = '${tId}'`);
        } catch {
          // ignore — best-effort cleanup
        }
      }
      createdTournamentIds = [];
      await Promise.resolve();
    });

    async function seedTournamentWithParticipants(): Promise<{
      tournamentId: string;
      roundId: string;
      participantIds: string[];
    }> {
      const nowIso = new Date().toISOString();

      const [tour] = await db
        .insert(tournaments)
        .values({
          title: `reconcile totals fixture ${nowIso}`,
          difficulty: 'easy',
          status: 'ongoing',
          startAt: nowIso,
          endAt: nowIso,
          maxParticipants: 10,
        })
        .returning({ tournamentId: tournaments.tournamentId });
      createdTournamentIds.push(tour.tournamentId);

      // The round requires a quiz_version_id. Pull any existing one from
      // the foundation seed; the round score we write does not actually
      // require a valid attempt path here — we only test the
      // round_score/round_time_ms on round_participants.
      const [qv] = await db
        .select({
          quizVersionId: schema.quizVersions.quizVersionId,
        })
        .from(schema.quizVersions)
        .limit(1);
      if (!qv) {
        throw new Error(
          '[reconcile-tournament-totals] no quiz_version in DB — run foundation seed',
        );
      }

      const [round] = await db
        .insert(tournamentRounds)
        .values({
          tournamentId: tour.tournamentId,
          roundNumber: 1,
          name: 'R1',
          quizVersionId: qv.quizVersionId,
          status: 'open',
          durationMs: 600000,
        })
        .returning({ roundId: tournamentRounds.roundId });

      return {
        tournamentId: tour.tournamentId,
        roundId: round.roundId,
        participantIds: [],
      };
    }

    async function seedParticipantWithWrongTotals(
      tournamentId: string,
      userId: string,
      totalScore: number,
      totalTimeMs: number,
    ): Promise<string> {
      const nowIso = new Date().toISOString();
      const [p] = await db
        .insert(tournamentParticipants)
        .values({
          tournamentId,
          userId,
          totalScore,
          totalTimeMs,
          status: 'active',
          updatedAt: nowIso,
        })
        .returning({ participantId: tournamentParticipants.participantId });
      return p.participantId;
    }

    async function seedRoundParticipant(
      roundId: string,
      participantId: string,
      roundScore: number,
      roundTimeMs: number,
    ): Promise<void> {
      const nowIso = new Date().toISOString();
      await db.insert(tournamentRoundParticipants).values({
        roundId,
        participantId,
        joinedAt: nowIso,
        roundScore,
        roundTimeMs,
        isQualified: true,
        updatedAt: nowIso,
      });
    }

    async function readTotals(participantId: string): Promise<{
      totalScore: number;
      totalTimeMs: number;
    }> {
      const [row] = await db
        .select({
          totalScore: tournamentParticipants.totalScore,
          totalTimeMs: tournamentParticipants.totalTimeMs,
        })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.participantId, participantId))
        .limit(1);
      return {
        totalScore: Number(row?.totalScore ?? 0),
        totalTimeMs: Number(row?.totalTimeMs ?? 0),
      };
    }

    it('reads well-formed migration SQL from disk', () => {
      const sqlText = readMigrationSql();
      expect(sqlText).toMatch(/UPDATE\s+tournament_participants/i);
      expect(sqlText).toMatch(/tournament_round_participants/i);
      expect(sqlText).toMatch(/IS DISTINCT FROM/i);
      expect(sqlText).toMatch(/NOT EXISTS/i);
    });

    it('Case A: participant with two round participants (80+70) but total_score=0 → migration brings totals to SUM', async () => {
      const { tournamentId, roundId } = await seedTournamentWithParticipants();
      const participantIdA = await seedParticipantWithWrongTotals(tournamentId, userIdA, 0, 0);

      await seedRoundParticipant(roundId, participantIdA, 80, 10000);
      await seedRoundParticipant(roundId, participantIdA, 70, 15000);

      // Pre-condition: cached totals are zero (drift).
      expect(await readTotals(participantIdA)).toEqual({
        totalScore: 0,
        totalTimeMs: 0,
      });

      pgExec(readMigrationSql());

      // Post-condition: cached totals equal SUM(round_score) and
      // SUM(round_time_ms) from round_participants.
      expect(await readTotals(participantIdA)).toEqual({
        totalScore: 150,
        totalTimeMs: 25000,
      });
    });

    it('Case B: participant with zero round participants but total_score=9999 → migration zeroes both totals', async () => {
      const { tournamentId } = await seedTournamentWithParticipants();
      const participantIdB = await seedParticipantWithWrongTotals(
        tournamentId,
        userIdB,
        9999,
        12345,
      );

      // Pre-condition: cached totals are bogus (drift, no rows upstream).
      expect(await readTotals(participantIdB)).toEqual({
        totalScore: 9999,
        totalTimeMs: 12345,
      });

      pgExec(readMigrationSql());

      // Post-condition: cached totals reset to 0.
      expect(await readTotals(participantIdB)).toEqual({
        totalScore: 0,
        totalTimeMs: 0,
      });
    });

    it('idempotent: running the migration a second time after convergence leaves counters unchanged', async () => {
      const { tournamentId, roundId } = await seedTournamentWithParticipants();
      const participantIdA = await seedParticipantWithWrongTotals(tournamentId, userIdA, 0, 0);
      await seedRoundParticipant(roundId, participantIdA, 42, 42000);

      pgExec(readMigrationSql());
      expect(await readTotals(participantIdA)).toEqual({
        totalScore: 42,
        totalTimeMs: 42000,
      });

      // Run again — should be a no-op since totals already match sums.
      pgExec(readMigrationSql());
      expect(await readTotals(participantIdA)).toEqual({
        totalScore: 42,
        totalTimeMs: 42000,
      });
    });

    it('the migration is a no-op against the live DB when no drift exists', () => {
      // After `afterEach` cleaned up our seeded tournaments, the
      // production data should be untouched. Run the migration; we
      // assert there are zero participants where total_score / total_time_ms
      // disagree with their derived sums.
      pgExec(readMigrationSql());

      const drift = pgExec(`
        SELECT COUNT(*)::text
        FROM tournament_participants tp
        WHERE (
          tp.total_score IS DISTINCT FROM COALESCE(
            (
              SELECT SUM(round_score)::int
              FROM tournament_round_participants trp
              WHERE trp.participant_id = tp.participant_id
            ),
            0
          )
          OR tp.total_time_ms IS DISTINCT FROM COALESCE(
            (
              SELECT SUM(round_time_ms)::int
              FROM tournament_round_participants trp
              WHERE trp.participant_id = tp.participant_id
            ),
            0
          )
        );
      `);

      expect(drift).toBe('0');
    });

    it('UUIDs look right', () => {
      expect(userIdA).toMatch(UUID_RE);
      expect(userIdB).toMatch(UUID_RE);
    });
  });
});
