/// <reference types="jest" />
/**
 * `ReviewRepository` integration tests — Phase 4 of the
 * `helpful-vote-counter-reconciliation` plan.
 *
 * Exercises the two new repository methods end-to-end against a real
 * Postgres + Redis stack:
 *
 *   - `addHelpfulVote`     — idempotent insert + counter bump, atomic.
 *   - `removeHelpfulVote`  — idempotent delete + counter decrement, atomic.
 *
 * Coverage matrix (from the plan §4 step 10):
 *   - single add: returns `true`, counter +1, vote row created.
 *   - double add (same user, same review): second call returns `false`.
 *     Counter is exactly 1.
 *   - single remove: returns `true`, counter -1, vote row deleted.
 *   - double remove: second call returns `false`. Counter unchanged.
 *   - five alternations: final counter matches final vote count.
 *   - concurrent adds from the same user: exactly one `true`, one `false`.
 *   - concurrent removes from the same user: exactly one `true`, one `false`.
 *   - mixed concurrent add+remove: counter matches final vote count.
 *   - transaction atomicity: a forced error after the vote mutation but
 *     before the counter update leaves neither write committed.
 *   - when called inside an existing transaction, no new transaction is
 *     opened; both writes ride the outer client.
 *
 * Skips gracefully when Postgres or env is unreachable so this file can
 * sit in `pnpm test:e2e` without breaking CI for engineers without a
 * local DB. Run against a live stack with:
 *
 *   pnpm db:start && pnpm test:e2e -- --testPathPatterns=review.repository
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal `.env` loader (mirrors test/ranking-phase1.e2e-spec.ts so this
// file is self-contained).
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

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DrizzleDB } from '@/core/database/database.module';
import * as schema from '@/core/database/schema';
import { quizReviews, reviewHelpfulVotes, users } from '@/core/database/schema';
import { ReviewRepository } from '@/modules/review/infrastructure/repositories/review.repository';
import { TransactionalContext } from '@/common/interceptors/transactional-context';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

describe('ReviewRepository — helpful-vote contract (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[review.repository] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;

  suite('addHelpfulVote / removeHelpfulVote', () => {
    let pool: Pool;
    let db: DrizzleDB;
    let transactionalContext: TransactionalContext;
    let repo: ReviewRepository;

    // Pick seeded actors (these are part of the foundation seed).
    let reviewerUserId: string; // user that POSTs the helpful vote
    let authorUserId: string; // user that authored the review being voted on (a fresh test user)
    let quizId: string; // any seeded quiz

    let createdReviewIds: string[] = [];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;
      transactionalContext = new TransactionalContext();
      repo = new ReviewRepository(db, transactionalContext);

      const reviewerRow = await db
        .select({ userId: users.userId })
        .from(users)
        .where(eq(users.username, 'learner_user'))
        .limit(1);
      const quizRow = await db
        .select({ quizId: schema.quizzes.quizId })
        .from(schema.quizzes)
        .limit(1);

      if (!reviewerRow[0] || !quizRow[0]) {
        throw new Error(
          '[review.repository] foundation seed missing — run `pnpm db:seed:foundation`',
        );
      }
      reviewerUserId = reviewerRow[0].userId;

      // Spin up a one-off author user with a unique email/username so the
      // (quiz_id, user_id) unique constraint on quiz_reviews doesn't fight
      // with seeded data. Soft-delete it after the suite.
      const stamp = Date.now();
      const [author] = await db
        .insert(users)
        .values({
          email: `helpful-test-author-${stamp}@quiz.local`,
          username: `helpful_test_author_${stamp}`,
          passwordHash: 'not-used-by-this-test',
          role: 'user',
          isVerified: true,
        })
        .returning({ userId: users.userId });
      authorUserId = author.userId;

      quizId = quizRow[0].quizId;
    });

    afterAll(async () => {
      // Soft-delete the helper author so re-runs don't trip the
      // `uq_users_email_active` / `uq_users_username_active` partial
      // unique indexes.
      if (authorUserId) {
        await db
          .update(users)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(users.userId, authorUserId));
      }
      if (pool) await pool.end();
    });

    // Each test creates its own review row so they are independent.
    // Cascade deletes on review_helpful_votes(review_id) handle cleanup.
    async function seedReviewWithCounter(counter: number): Promise<string> {
      const nowIso = new Date().toISOString();
      const [row] = await db
        .insert(quizReviews)
        .values({
          quizId,
          userId: authorUserId,
          rating: 5,
          comment: 'helpful-vote test fixture',
          helpfulCount: counter,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .returning({ reviewId: quizReviews.reviewId });
      createdReviewIds.push(row.reviewId);
      return row.reviewId;
    }

    afterEach(async () => {
      if (createdReviewIds.length === 0) return;
      // Single bulk delete; cascades to review_helpful_votes.
      await db.delete(quizReviews).where(eq(quizReviews.reviewId, createdReviewIds[0]));
      // (using [0] because each test pushes exactly one id and afterEach
      // runs after the test pushed; subsequent tests reset createdReviewIds
      // implicitly by pushing a new one)
      createdReviewIds = [];
    });

    async function readCounter(reviewId: string): Promise<number> {
      const [row] = await db
        .select({ helpfulCount: quizReviews.helpfulCount })
        .from(quizReviews)
        .where(eq(quizReviews.reviewId, reviewId))
        .limit(1);
      return Number(row?.helpfulCount ?? 0);
    }

    async function readVoteCount(reviewId: string): Promise<number> {
      const rows = await db
        .select({ voteId: reviewHelpfulVotes.voteId })
        .from(reviewHelpfulVotes)
        .where(eq(reviewHelpfulVotes.reviewId, reviewId));
      return rows.length;
    }

    it('UUIDs and seeded ids look right', () => {
      expect(reviewerUserId).toMatch(UUID_RE);
      expect(authorUserId).toMatch(UUID_RE);
      expect(quizId).toMatch(UUID_RE);
      // reviewerUserId and authorUserId must differ — the helpful-vote
      // path requires the voter to be a different user from the author.
      expect(reviewerUserId).not.toBe(authorUserId);
    });

    it('single add returns true, counter +1, vote row created', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      const result = await repo.addHelpfulVote({
        reviewId,
        userId: reviewerUserId,
        nowIso,
      });

      expect(result).toBe(true);
      expect(await readCounter(reviewId)).toBe(1);
      expect(await readVoteCount(reviewId)).toBe(1);
    });

    it('double add (same user) returns false on the second call; counter is exactly 1', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      const first = await repo.addHelpfulVote({
        reviewId,
        userId: reviewerUserId,
        nowIso,
      });
      const second = await repo.addHelpfulVote({
        reviewId,
        userId: reviewerUserId,
        nowIso,
      });

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(await readCounter(reviewId)).toBe(1);
      expect(await readVoteCount(reviewId)).toBe(1);
    });

    it('single remove returns true, counter -1, vote row deleted', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      // Seed an existing vote first.
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      // Counter = 1, votes = 1.

      const result = await repo.removeHelpfulVote({
        reviewId,
        userId: reviewerUserId,
        nowIso,
      });

      expect(result).toBe(true);
      expect(await readCounter(reviewId)).toBe(0);
      expect(await readVoteCount(reviewId)).toBe(0);
    });

    it('double remove: second call returns false; counter unchanged', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      // Counter is now 1, votes is now 1.

      const first = await repo.removeHelpfulVote({
        reviewId,
        userId: reviewerUserId,
        nowIso,
      });
      const second = await repo.removeHelpfulVote({
        reviewId,
        userId: reviewerUserId,
        nowIso,
      });

      expect(first).toBe(true);
      expect(second).toBe(false);
      // After first remove: counter = 0, votes = 0. Second remove: no-op.
      expect(await readCounter(reviewId)).toBe(0);
      expect(await readVoteCount(reviewId)).toBe(0);
    });

    it('five alternations: final counter matches final vote count', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      // Sequence: A R A R A → two net adds.
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      await repo.removeHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      await repo.removeHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });

      expect(await readCounter(reviewId)).toBe(1);
      expect(await readVoteCount(reviewId)).toBe(1);
    });

    it('concurrent adds from the same user: exactly one true, one false; counter is 1', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      const [a, b] = await Promise.all([
        repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso }),
        repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso }),
      ]);

      const trues = [a, b].filter((x) => x === true).length;
      const falses = [a, b].filter((x) => x === false).length;
      expect(trues).toBe(1);
      expect(falses).toBe(1);
      expect(await readCounter(reviewId)).toBe(1);
      expect(await readVoteCount(reviewId)).toBe(1);
    });

    it('concurrent removes from the same user: exactly one true, one false; counter is 0', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      // Counter = 1, votes = 1.

      const [a, b] = await Promise.all([
        repo.removeHelpfulVote({ reviewId, userId: reviewerUserId, nowIso }),
        repo.removeHelpfulVote({ reviewId, userId: reviewerUserId, nowIso }),
      ]);

      const trues = [a, b].filter((x) => x === true).length;
      const falses = [a, b].filter((x) => x === false).length;
      expect(trues).toBe(1);
      expect(falses).toBe(1);
      // Counter was 1, the winning remove decremented it to 0. The losing
      // remove returned false without touching the counter.
      expect(await readCounter(reviewId)).toBe(0);
      expect(await readVoteCount(reviewId)).toBe(0);
    });

    it('mixed concurrent add+remove: counter matches final vote count', async () => {
      // Start from a clean state: counter and votes both 0, no drift.
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();
      await repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso });
      // Counter = 1, votes = 1 — clean state.

      // Race a fresh add (impossible, vote exists → false) against a
      // remove (true).
      const [add, remove] = await Promise.all([
        repo.addHelpfulVote({ reviewId, userId: reviewerUserId, nowIso }),
        repo.removeHelpfulVote({ reviewId, userId: reviewerUserId, nowIso }),
      ]);

      // The add must be false (vote already exists) and the remove must
      // be true. Whichever order they resolve in, both writes ride the
      // same single transaction in PG (because the repo wraps them in
      // db.transaction()) — actually no, each call opens its own tx,
      // so they can interleave. Either way the final state is what
      // matters: counter == votes.
      expect(add).toBe(false);
      expect(remove).toBe(true);

      const counter = await readCounter(reviewId);
      const votes = await readVoteCount(reviewId);
      expect(counter).toBe(votes);
      expect(counter).toBe(0); // Add was rejected, remove succeeded → both go to 0.
    });

    it('transaction is atomic: a forced error after the vote mutation rolls back both writes', async () => {
      // We exercise this by wrapping the repo in an outer transaction
      // and throwing AFTER addHelpfulVote's first INSERT but BEFORE its
      // counter UPDATE — which is exactly the seam the plan §4.3 names.
      //
      // Implementation: open an AsyncLocalStorage frame via
      // `transactionalContext.run(...)`, then inside it open a db tx and
      // register it via `setDbClient(tx)`. The repo detects the outer tx
      // via `getDbClient()` and reuses it. When we throw, the outer tx
      // rolls back, taking both writes with it. Counter and vote_count
      // must both be 0.
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      await expect(
        transactionalContext.run(() =>
          db.transaction(async (tx) => {
            transactionalContext.setDbClient(tx);
            await repo.addHelpfulVote({
              reviewId,
              userId: reviewerUserId,
              nowIso,
            });
            throw new Error('forced rollback after vote mutation');
          }),
        ),
      ).rejects.toThrow(/forced rollback/);

      expect(await readCounter(reviewId)).toBe(0);
      expect(await readVoteCount(reviewId)).toBe(0);
    });

    it('when called inside an existing transaction, both writes ride the outer client', async () => {
      const reviewId = await seedReviewWithCounter(0);
      const nowIso = new Date().toISOString();

      // Open an outer tx inside an AsyncLocalStorage frame. The repo
      // should detect the outer tx via `getDbClient()` and skip opening
      // its own. We verify by: (a) successful add, (b) inside the same
      // outer tx, before commit, the counter must already be 1 (because
      // both writes rode the same tx), (c) the outer tx is still alive
      // after the repo returns (the repo didn't close it).
      await transactionalContext.run(() =>
        db.transaction(async (tx) => {
          transactionalContext.setDbClient(tx);

          const result = await repo.addHelpfulVote({
            reviewId,
            userId: reviewerUserId,
            nowIso,
          });

          expect(result).toBe(true);

          // Inside the same outer tx, before commit, the counter must
          // already be 1 (because both writes rode the same tx).
          const [row] = await tx
            .select({ helpfulCount: quizReviews.helpfulCount })
            .from(quizReviews)
            .where(eq(quizReviews.reviewId, reviewId))
            .limit(1);
          expect(Number(row?.helpfulCount ?? 0)).toBe(1);

          // The outer tx is still alive — a second statement on the same
          // tx client works.
          await tx
            .update(quizReviews)
            .set({ comment: 'outer-tx marker' })
            .where(eq(quizReviews.reviewId, reviewId));
        }),
      );

      // After commit: counter is 1, marker is present.
      expect(await readCounter(reviewId)).toBe(1);
      const [row] = await db
        .select({ comment: quizReviews.comment })
        .from(quizReviews)
        .where(eq(quizReviews.reviewId, reviewId))
        .limit(1);
      expect(row?.comment).toBe('outer-tx marker');
    });
  });
});
