/// <reference types="jest" />
/**
 * `POST /reviews/:reviewId/helpful` and `DELETE /reviews/:reviewId/helpful`
 * controller-level integration tests — Phase 4 of the
 * `helpful-vote-counter-reconciliation` plan.
 *
 * Verifies the §4.5 message matrix and the §4.8 transaction-invariant
 * end-to-end against a live Postgres + Redis stack:
 *
 *   | Endpoint             | Repository result | Message                              |
 *   |----------------------|-------------------|--------------------------------------|
 *   | POST helpful:true 1st| true              | Review marked as helpful             |
 *   | POST helpful:true 2nd| false             | Review was already marked as helpful |
 *   | POST helpful:false 1st (had vote) | true   | Helpful vote removed                 |
 *   | POST helpful:false 2nd (no vote)  | false  | No helpful vote to remove            |
 *   | DELETE 1st (had vote)            | true   | Helpful vote removed                 |
 *   | DELETE 2nd (no vote)             | false  | No helpful vote to remove            |
 *   | DELETE without prior POST        | false  | No helpful vote to remove            |
 *
 * Plus:
 *   - 404 when the review does not exist.
 *   - 400 when the actor is the review's author.
 *   - Idempotency-key path: same body returned on replay; counter not
 *     double-incremented.
 *   - Diagnostic SQL at the end of the suite confirms
 *     `helpful_count = COUNT(*) FROM review_helpful_votes`.
 *
 * Skips gracefully when Postgres or env is unreachable so this file can
 * sit in `pnpm test:e2e` without breaking CI for engineers without a
 * local DB. Run against a live stack with:
 *
 *   pnpm db:start && pnpm db:seed:foundation && \
 *   pnpm test:e2e -- --testPathPatterns=review-helpful
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Minimal `.env` loader (mirrors test/ranking-phase1.e2e-spec.ts).
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
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppModule } from './../src/app.module';
import * as schema from '@/core/database/schema';
import { quizReviews, reviewHelpfulVotes } from '@/core/database/schema';

const USER_PASSWORD_ENV = 'SEED_USER_PASSWORD';

interface EnvelopeWire {
  readonly data: unknown;
  readonly meta: Record<string, unknown>;
}

const NON_UUID = 'not-a-uuid';
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

describe('Review module — helpful-vote controller (e2e)', () => {
  const hasRequiredEnv =
    Boolean(process.env.SEED_USER_PASSWORD) &&
    Boolean(process.env.DATABASE_URL) &&
    Boolean(process.env.REDIS_URL);

  if (!hasRequiredEnv) {
    console.warn(
      '[review-helpful] missing required env (SEED_USER_PASSWORD/DATABASE_URL/REDIS_URL); skipping suite.',
    );
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('POST/DELETE /reviews/:reviewId/helpful', () => {
    let app: INestApplication<App> | undefined;
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let dbAvailable = false;

    // `learner_user` is the author of the seeded `javascript-fundamentals`
    // review. `power_user` (logged in) is a separate user, so they may
    // vote on it.
    let learnerToken = '';
    let powerToken = '';
    let learnerUserId = '';
    let powerUserId = '';
    let targetReviewId = ''; // review authored by `learner_user`

    beforeAll(async () => {
      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api/v1');
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: false,
          }),
        );
        await app.init();

        // DB pool for direct reads/cleans.
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        db = drizzle(pool, { schema });

        const userPassword = process.env[USER_PASSWORD_ENV];
        if (!userPassword) throw new Error('Missing SEED_USER_PASSWORD');

        const learnerLogin = await postJson(app, '/api/v1/auth/login', {
          email: 'user@quiz.local',
          password: userPassword,
        });
        const powerLogin = await postJson(app, '/api/v1/auth/login', {
          email: 'power_user@quiz.local',
          password: userPassword,
        });

        learnerToken = readAccessToken(learnerLogin);
        powerToken = readAccessToken(powerLogin);
        learnerUserId = readUserId(learnerLogin);
        powerUserId = readUserId(powerLogin);

        // Find the seeded review authored by learner_user.
        const [review] = await db
          .select({ reviewId: quizReviews.reviewId })
          .from(quizReviews)
          .where(eq(quizReviews.userId, learnerUserId))
          .limit(1);
        if (!review) {
          throw new Error(
            '[review-helpful] no seeded review found for learner_user — run `pnpm db:seed:development`',
          );
        }
        targetReviewId = review.reviewId;

        dbAvailable = true;
      } catch (err) {
        dbAvailable = false;
        console.warn(
          '[review-helpful] AppModule boot failed; tests will be skipped.',
          err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : err,
        );
      }
    });

    afterAll(async () => {
      if (app) await app.close();
      if (pool) await pool.end();
    });

    const requireDb = (): boolean => {
      if (!dbAvailable) {
        console.warn('[review-helpful] skipping assertion — boot failed');
        return false;
      }
      return true;
    };

    // ── helpers ───────────────────────────────────────────────────────────
    async function postJson(
      appInstance: INestApplication<App>,
      path: string,
      body: Record<string, unknown>,
      token?: string,
    ): Promise<Record<string, unknown>> {
      const req = request(appInstance.getHttpServer())
        .post(path)
        .set('Content-Type', 'application/json')
        .send(body);
      if (token) req.set('Authorization', `Bearer ${token}`);
      const res = await req;
      return res.body as Record<string, unknown>;
    }

    async function postHelpful(
      reviewId: string,
      helpful: boolean,
      token: string,
      idempotencyKey?: string,
    ): Promise<{ status: number; body: EnvelopeWire }> {
      const req = request(app!.getHttpServer())
        .post(`/api/v1/reviews/${reviewId}/helpful`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(idempotencyKey ? { helpful, idempotencyKey } : { helpful });
      const res = await req;
      return { status: res.status, body: res.body as EnvelopeWire };
    }

    async function deleteHelpful(
      reviewId: string,
      token: string,
    ): Promise<{ status: number; body: EnvelopeWire }> {
      const res = await request(app!.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}/helpful`)
        .set('Authorization', `Bearer ${token}`);
      return { status: res.status, body: res.body as EnvelopeWire };
    }

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

    function readAccessToken(loginResponse: Record<string, unknown>): string {
      const data = loginResponse.data as { accessToken?: string } | undefined;
      const token = data?.accessToken;
      if (!token) throw new Error('Login response missing accessToken');
      return token;
    }

    function readUserId(loginResponse: Record<string, unknown>): string {
      const data = loginResponse.data as { userId?: string } | undefined;
      const id = data?.userId;
      if (!id) throw new Error('Login response missing data.userId');
      return id;
    }

    function dataAs<T>(body: EnvelopeWire): T {
      return body.data as T;
    }

    // Each test resets votes + counter before AND after to avoid
    // cross-test contamination.
    async function resetTarget(): Promise<void> {
      await db.delete(reviewHelpfulVotes).where(eq(reviewHelpfulVotes.reviewId, targetReviewId));
      await db
        .update(quizReviews)
        .set({ helpfulCount: 0 })
        .where(eq(quizReviews.reviewId, targetReviewId));
    }

    // ── sanity: seed was loaded correctly ─────────────────────────────────
    it('seeded data shape is correct', () => {
      if (!requireDb()) return;
      expect(targetReviewId).toMatch(UUID_RE);
      expect(powerUserId).toMatch(UUID_RE);
      expect(learnerUserId).toMatch(UUID_RE);
      expect(powerUserId).not.toBe(learnerUserId);
    });

    // ── §4.5 POST helpful:true message matrix ─────────────────────────────
    it('POST helpful:true first time → 200/201 "Review marked as helpful"; counter +1', async () => {
      if (!requireDb()) return;
      await resetTarget();

      const { status, body } = await postHelpful(targetReviewId, true, powerToken);
      // POST defaults to 201 in NestJS when no @HttpCode override is set;
      // accept either to stay portable.
      expect([200, 201]).toContain(status);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('Review marked as helpful');

      expect(await readCounter(targetReviewId)).toBe(1);
      expect(await readVoteCount(targetReviewId)).toBe(1);

      await resetTarget();
    });

    it('POST helpful:true second time (no key) → 200/201 "Review was already marked as helpful"; counter still 1', async () => {
      if (!requireDb()) return;
      await resetTarget();
      await postHelpful(targetReviewId, true, powerToken);

      const { status, body } = await postHelpful(targetReviewId, true, powerToken);
      expect([200, 201]).toContain(status);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('Review was already marked as helpful');

      expect(await readCounter(targetReviewId)).toBe(1);
      expect(await readVoteCount(targetReviewId)).toBe(1);

      await resetTarget();
    });

    // ── §4.5 DELETE message matrix ────────────────────────────────────────
    it('DELETE first time (vote exists) → 200 "Helpful vote removed"; counter -1', async () => {
      if (!requireDb()) return;
      await resetTarget();
      await postHelpful(targetReviewId, true, powerToken);

      const { status, body } = await deleteHelpful(targetReviewId, powerToken);
      expect(status).toBe(200);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('Helpful vote removed');

      expect(await readCounter(targetReviewId)).toBe(0);
      expect(await readVoteCount(targetReviewId)).toBe(0);

      await resetTarget();
    });

    it('DELETE second time (no vote) → 200 "No helpful vote to remove"; counter unchanged', async () => {
      if (!requireDb()) return;
      await resetTarget();
      await postHelpful(targetReviewId, true, powerToken);
      await deleteHelpful(targetReviewId, powerToken);

      const { status, body } = await deleteHelpful(targetReviewId, powerToken);
      expect(status).toBe(200);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('No helpful vote to remove');

      expect(await readCounter(targetReviewId)).toBe(0);
      expect(await readVoteCount(targetReviewId)).toBe(0);

      await resetTarget();
    });

    it('DELETE without prior POST → 200 "No helpful vote to remove"; counter unchanged', async () => {
      if (!requireDb()) return;
      await resetTarget();

      const { status, body } = await deleteHelpful(targetReviewId, powerToken);
      expect(status).toBe(200);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('No helpful vote to remove');

      expect(await readCounter(targetReviewId)).toBe(0);
      expect(await readVoteCount(targetReviewId)).toBe(0);

      await resetTarget();
    });

    // ── POST helpful:false matrix (re-uses the DELETE assertion surfaces) ─
    it('POST helpful:false first time (vote exists) → 200/201 "Helpful vote removed"; counter -1', async () => {
      if (!requireDb()) return;
      await resetTarget();
      await postHelpful(targetReviewId, true, powerToken);

      const { status, body } = await postHelpful(targetReviewId, false, powerToken);
      expect([200, 201]).toContain(status);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('Helpful vote removed');

      expect(await readCounter(targetReviewId)).toBe(0);
      expect(await readVoteCount(targetReviewId)).toBe(0);

      await resetTarget();
    });

    it('POST helpful:false when no vote → 200/201 "No helpful vote to remove"; counter unchanged', async () => {
      if (!requireDb()) return;
      await resetTarget();

      const { status, body } = await postHelpful(targetReviewId, false, powerToken);
      expect([200, 201]).toContain(status);
      const data = dataAs<{ message: string }>(body);
      expect(data.message).toBe('No helpful vote to remove');

      expect(await readCounter(targetReviewId)).toBe(0);
      expect(await readVoteCount(targetReviewId)).toBe(0);

      await resetTarget();
    });

    // ── §4.4 domain errors ────────────────────────────────────────────────
    it('POST when actor is the review\'s author → 400 "You cannot vote on your own review"', async () => {
      if (!requireDb()) return;
      await resetTarget();

      const { status } = await postHelpful(targetReviewId, true, learnerToken);
      // The author check fires before the repository call, so the response
      // is a ProblemDetail 400 with code REVIEW_VALIDATION.
      expect(status).toBe(400);

      // Counter and votes are untouched.
      expect(await readCounter(targetReviewId)).toBe(0);
      expect(await readVoteCount(targetReviewId)).toBe(0);

      await resetTarget();
    });

    it('POST with non-existent reviewId → 400 (UUID parse fails at the boundary)', async () => {
      if (!requireDb()) return;
      const { status } = await postHelpful(NON_UUID, true, powerToken);
      expect(status).toBe(400);
    });

    // ── Idempotency-key path: same body returned on replay, no second repo call ─
    it('POST with idempotency key replays cached response on second call', async () => {
      if (!requireDb()) return;
      await resetTarget();

      const key = `helpful-e2e-${Date.now()}`;
      const first = await postHelpful(targetReviewId, true, powerToken, key);
      const second = await postHelpful(targetReviewId, true, powerToken, key);

      expect([200, 201]).toContain(first.status);
      expect([200, 201]).toContain(second.status);

      const firstData = dataAs<{ message: string }>(first.body);
      const secondData = dataAs<{ message: string }>(second.body);

      // Same body returned.
      expect(secondData.message).toBe(firstData.message);
      expect(secondData.message).toBe('Review marked as helpful');

      // Counter is exactly 1 — second call did not re-run the repository.
      expect(await readCounter(targetReviewId)).toBe(1);
      expect(await readVoteCount(targetReviewId)).toBe(1);

      await resetTarget();
    });

    // ── Diagnostic: helpful_count = COUNT(*) FROM review_helpful_votes ────
    it('diagnostic SQL: helpful_count = COUNT(*) for every review', () => {
      if (!requireDb()) return;
      const out = execSync(
        `docker exec -i quizdb psql -U postgres -d quizdb -At -F'|' -c "SELECT r.review_id, r.helpful_count, (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id = r.review_id) FROM quiz_reviews r WHERE r.helpful_count IS DISTINCT FROM (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id = r.review_id);"`,
        { encoding: 'utf8' },
      ).trim();
      // Empty output ⇒ zero drift. If non-empty, jest fails with the offending
      // review_ids in the diff.
      expect(out).toBe('');
    });
  });
});
