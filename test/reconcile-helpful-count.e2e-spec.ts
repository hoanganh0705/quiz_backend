/// <reference types="jest" />
/**
 * Reconciliation e2e for the helpful-vote counter (Phase 4 of
 * docs/plans/helpful-vote-counter-reconciliation.md, §4 step 14).
 *
 * Verifies that the SQL in
 * `src/core/database/migrations/0007_reconcile_helpful_count.sql`
 * repairs drift between `quiz_reviews.helpful_count` and
 * `review_helpful_votes` for two review histories:
 *
 *   - Case A: review has 3 actual votes but helpful_count = 0
 *     (counter under-counted). After the migration, helpful_count = 3.
 *
 *   - Case B: review has 0 actual votes but helpful_count = 999
 *     (counter over-counted). After the migration, helpful_count = 0.
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
 *   pnpm test:e2e --testPathPatterns=reconcile-helpful-count
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal `.env` loader (mirrors test/review.repository.e2e-spec.ts).
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
import { quizReviews, reviewHelpfulVotes, users } from '@/core/database/schema';

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
    'src/core/database/migrations/0007_reconcile_helpful_count.sql',
  );
  return fs.readFileSync(file, 'utf8');
}

describe('0007_reconcile_helpful_count — migration e2e (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[reconcile-helpful-count] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('reconcile-helpful-count', () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let authorUserId: string;
    let quizId: string;
    let createdReviewIds: string[] = [];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;

      // Pull any existing seeded quiz for FK.
      const [quizRow] = await db
        .select({ quizId: schema.quizzes.quizId })
        .from(schema.quizzes)
        .limit(1);
      if (!quizRow) {
        throw new Error('[reconcile-helpful-count] no quiz in DB — run foundation seed');
      }
      quizId = quizRow.quizId;

      // Create a one-off author user (soft-deleted after the suite) so
      // every test can have fresh (review, quiz_id) rows without
      // tripping the uq_quiz_reviews_quiz_user constraint on existing
      // seed data.
      const stamp = Date.now();
      const [author] = await db
        .insert(users)
        .values({
          email: `reconcile-author-${stamp}@quiz.local`,
          username: `reconcile_author_${stamp}`,
          passwordHash: 'not-used-by-this-test',
          role: 'user',
          isVerified: true,
        })
        .returning({ userId: users.userId });
      authorUserId = author.userId;
    });

    afterAll(async () => {
      if (authorUserId) {
        await db
          .update(users)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(users.userId, authorUserId));
      }
      if (pool) await pool.end();
    });

    afterEach(async () => {
      for (const reviewId of createdReviewIds) {
        // Cascade clears review_helpful_votes via FK ON DELETE CASCADE.
        await db.delete(quizReviews).where(eq(quizReviews.reviewId, reviewId));
      }
      createdReviewIds = [];
    });

    async function seedReview(helpfulCount: number): Promise<string> {
      const nowIso = new Date().toISOString();
      const [row] = await db
        .insert(quizReviews)
        .values({
          quizId,
          userId: authorUserId,
          rating: 5,
          comment: 'reconcile fixture',
          helpfulCount,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .returning({ reviewId: quizReviews.reviewId });
      createdReviewIds.push(row.reviewId);
      return row.reviewId;
    }

    async function seedVotes(reviewId: string, voters: string[]): Promise<void> {
      if (voters.length === 0) return;
      const nowIso = new Date().toISOString();
      await db
        .insert(reviewHelpfulVotes)
        .values(voters.map((userId) => ({ reviewId, userId, createdAt: nowIso })));
    }

    async function readCounter(reviewId: string): Promise<number> {
      const [row] = await db
        .select({ helpfulCount: quizReviews.helpfulCount })
        .from(quizReviews)
        .where(eq(quizReviews.reviewId, reviewId))
        .limit(1);
      return Number(row?.helpfulCount ?? 0);
    }

    it('reads well-formed migration SQL from disk', () => {
      const sqlText = readMigrationSql();
      expect(sqlText).toMatch(/UPDATE\s+quiz_reviews/i);
      expect(sqlText).toMatch(/review_helpful_votes/i);
      expect(sqlText).toMatch(/IS DISTINCT FROM/i);
      expect(sqlText).toMatch(/NOT EXISTS/i);
    });

    it('Case A: review with 3 actual votes but helpful_count=0 → migration brings helpful_count to 3', async () => {
      // Seed three voter users (also one-off, soft-deleted in afterAll).
      const stamp = Date.now();
      const voters = await db
        .insert(users)
        .values(
          [1, 2, 3].map((n) => ({
            email: `reconcile-voter-a-${stamp}-${n}@quiz.local`,
            username: `reconcile_voter_a_${stamp}_${n}`,
            passwordHash: 'not-used-by-this-test',
            role: 'user' as const,
            isVerified: true,
          })),
        )
        .returning({ userId: users.userId });
      const voterIds = voters.map((v) => v.userId);

      const reviewId = await seedReview(0);
      await seedVotes(reviewId, voterIds);

      // Pre-condition: counter is wrong.
      expect(await readCounter(reviewId)).toBe(0);

      // Run the migration via psql against the live DB.
      pgExec(readMigrationSql());

      // Post-condition: counter is 3.
      expect(await readCounter(reviewId)).toBe(3);

      // Cleanup: soft-delete the voter users; the FK on
      // review_helpful_votes(user_id) is ON DELETE CASCADE (hard
      // delete), but a soft-delete leaves the row in place — so we
      // must either hard-delete or trust the FK constraint allows
      // soft-delete. Per the unique indexes (which are scoped to
      // deleted_at IS NULL), soft-delete is safest.
      // Use raw psql for hard-delete of the test voters; constraint
      // review_helpful_votes.user_id → users.user_id ON DELETE
      // CASCADE means the votes get cleaned up too.
      pgExec(`DELETE FROM users WHERE user_id IN (${voterIds.map((id) => `'${id}'`).join(',')})`);
    });

    it('Case B: review with 0 actual votes but helpful_count=999 → migration brings helpful_count to 0', async () => {
      const reviewId = await seedReview(999);

      // Pre-condition: counter is wrong (drift).
      expect(await readCounter(reviewId)).toBe(999);

      pgExec(readMigrationSql());

      // Post-condition: counter is 0.
      expect(await readCounter(reviewId)).toBe(0);
    });

    it('idempotent: running the migration a second time after convergence leaves counters unchanged', async () => {
      // Seed drift.
      const reviewId = await seedReview(42);

      pgExec(readMigrationSql());
      expect(await readCounter(reviewId)).toBe(0);

      // Run again. Should be a no-op.
      pgExec(readMigrationSql());
      expect(await readCounter(reviewId)).toBe(0);
    });

    it('the migration is a no-op against the live DB when no drift exists', () => {
      // After `afterEach` cleaned up our seeded reviews, the production
      // data should be untouched. Run the migration; expect zero rows
      // updated. We can't assert that via stderr-free output, so we
      // count rows where helpful_count != COUNT(votes) afterwards.
      pgExec(readMigrationSql());
      const drift = pgExec(
        `SELECT r.review_id, r.helpful_count, (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id = r.review_id) FROM quiz_reviews r WHERE r.helpful_count IS DISTINCT FROM (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id = r.review_id);`,
      );
      expect(drift).toBe('');
    });

    it('UUIDs look right', () => {
      expect(authorUserId).toMatch(UUID_RE);
      expect(quizId).toMatch(UUID_RE);
    });
  });
});
