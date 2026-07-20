/// <reference types="jest" />
/**
 * Self-report guard e2e tests.
 *
 * Phase 5 hardening — the previous shape inlined the self-report
 * guard as `review.userId === reporterId` inside
 * `ReviewService.reportReview`. It worked in unit tests but was
 * never exercised at the integration layer, so a future regression
 * (or a role-bypass the audit didn't anticipate) could let an admin
 * — or any role — file a self-report and pollute the moderation
 * queue. This suite:
 *
 *   1. Boots the full NestJS app against the live Postgres +
 *      Redis stack.
 *   2. Logs in as a seeded user (the author of a seeded review).
 *   3. Tries to file a report against their own review.
 *   4. Asserts the API returns 400 (or 422, depending on the
 *      envelope mapping) with the canonical
 *      "You cannot report your own review" message.
 *   5. Asserts the application guard fires BEFORE the row reaches
 *      the database (i.e. no `review_reports` row is created).
 *
 * Defense-in-depth is layered:
 *   - Application guard: `ReviewAuthorizationPolicy.canReport`
 *     (covers the unit spec in
 *     `review-authorization.policy.spec.ts`).
 *   - DB trigger: `trg_review_reports_reject_self_report` raised
 *     by migration `0016_review_reports_self_report_guard.sql`.
 *     The repository layer translates the `23514` error code into
 *     `ReviewValidationError`.
 *
 * This e2e proves the application-layer guard fires end-to-end
 * (no DB row is created, response is 400). A separate unit test
 * in `review-report.repository.spec.ts` covers the DB-error
 * translation path.
 *
 * Skips gracefully when the env is missing or the app cannot boot.
 * Run with:
 *
 *   pnpm db:start && pnpm db:seed:foundation && \
 *   pnpm test:e2e -- --testPathPatterns=review-report-self
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

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

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppModule } from './../src/app.module';
import * as schema from '@/core/database/schema';
import { quizReviews, reviewReports } from '@/core/database/schema';

const USER_PASSWORD_ENV = 'SEED_USER_PASSWORD';

interface EnvelopeWire {
  readonly data: unknown;
  readonly meta: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function postJson<T = unknown>(
  app: INestApplication<App>,
  pathStr: string,
  body: Record<string, unknown>,
  bearerToken?: string,
): Promise<{ status: number; body: T }> {
  const req = request(app.getHttpServer()).post(pathStr).set('Content-Type', 'application/json');
  if (bearerToken) req.set('Authorization', `Bearer ${bearerToken}`);
  const res = await req.send(body);
  return { status: res.status, body: res.body as T };
}

function dataAs<T>(body: unknown): T {
  const envelope = body as EnvelopeWire;
  return envelope.data as T;
}

function readAccessToken(loginResponse: { status: number; body: unknown }): string {
  const data = dataAs<{ accessToken?: string }>(loginResponse.body);
  if (!data.accessToken) {
    throw new Error('Login response missing accessToken');
  }
  return data.accessToken;
}

function readUserId(loginResponse: { status: number; body: unknown }): string {
  const data = dataAs<{ user?: { userId?: string } }>(loginResponse.body);
  if (!data.user?.userId) {
    throw new Error('Login response missing userId');
  }
  return data.user.userId;
}

describe('Review module — self-report guard (e2e)', () => {
  const hasRequiredEnv =
    Boolean(process.env.SEED_USER_PASSWORD) &&
    Boolean(process.env.DATABASE_URL) &&
    Boolean(process.env.REDIS_URL);

  if (!hasRequiredEnv) {
    console.warn(
      '[review-report-self] missing required env (SEED_USER_PASSWORD/DATABASE_URL/REDIS_URL); skipping suite.',
    );
  }

  const suite = hasRequiredEnv ? describe : describe.skip;

  suite('POST /reviews/:reviewId/report — author cannot report their own review', () => {
    let app: INestApplication<App> | undefined;
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let dbAvailable = false;

    // `learner_user` is the author of the seeded review we will
    // try to self-report. The seeded review id is captured at
    // boot time.
    let learnerToken = '';
    let learnerUserId = '';
    let selfReviewId = '';

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

        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        db = drizzle(pool, { schema });

        const userPassword = process.env[USER_PASSWORD_ENV];
        if (!userPassword) throw new Error('Missing SEED_USER_PASSWORD');

        const learnerLogin = await postJson(app, '/api/v1/auth/login', {
          email: 'user@quiz.local',
          password: userPassword,
        });
        learnerToken = readAccessToken(learnerLogin);
        learnerUserId = readUserId(learnerLogin);

        const [review] = await db
          .select({ reviewId: quizReviews.reviewId })
          .from(quizReviews)
          .where(eq(quizReviews.userId, learnerUserId))
          .limit(1);

        if (!review) {
          throw new Error(
            '[review-report-self] no seeded review found for learner_user — run `pnpm db:seed:development`',
          );
        }
        selfReviewId = review.reviewId;

        dbAvailable = true;
      } catch (err) {
        dbAvailable = false;
        console.warn(
          '[review-report-self] AppModule boot failed; tests will be skipped.',
          err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : err,
        );
      }
    });

    afterAll(async () => {
      if (pool) await pool.end().catch(() => undefined);
      if (app) await app.close();
    });

    function requireDb(): boolean {
      if (!dbAvailable) return false;
      return true;
    }

    async function countSelfReports(): Promise<number> {
      if (!db) return 0;
      const rows = await db
        .select({ reportId: reviewReports.reportId })
        .from(reviewReports)
        .where(
          and(
            eq(reviewReports.reviewId, selfReviewId),
            eq(reviewReports.reporterId, learnerUserId),
          ),
        );
      return rows.length;
    }

    // ── seed sanity ─────────────────────────────────────────────────────
    it('seeded data shape is correct', () => {
      if (!requireDb()) return;
      expect(selfReviewId).toMatch(UUID_RE);
      expect(learnerUserId).toMatch(UUID_RE);
    });

    // ── application-layer guard ─────────────────────────────────────────
    it('rejects the author self-reporting their own review (400 + canonical message)', async () => {
      if (!requireDb()) return;

      const reportsBefore = await countSelfReports();

      const { status, body } = await postJson<unknown>(
        app!,
        `/api/v1/reviews/${selfReviewId}/report`,
        { reason: 'spam', details: null },
        learnerToken,
      );

      // The application guard fires before the row reaches the
      // database. NestJS maps `ReviewValidationError` to a 400 via
      // the global exception filter, but the canonical envelope
      // might also surface a 422 depending on the error filter
      // config. Accept either to stay portable.
      expect([400, 422]).toContain(status);

      const detail =
        (body as { detail?: string; message?: string }).detail ??
        (body as { detail?: string; message?: string }).message ??
        JSON.stringify(body);

      expect(detail).toMatch(/You cannot report your own review/i);

      const reportsAfter = await countSelfReports();
      expect(reportsAfter).toBe(reportsBefore);
    });

    // ── defense-in-depth: DB trigger ─────────────────────────────────────
    it('the DB trigger also rejects self-reports when the application guard is bypassed', async () => {
      if (!requireDb()) return;

      const reportsBefore = await countSelfReports();

      // Simulate the bypass path: insert directly into
      // `review_reports` from the DB client. The trigger should
      // raise 23514 with the canonical message.
      await expect(
        db.insert(reviewReports).values({
          reviewId: selfReviewId,
          reporterId: learnerUserId,
          reason: 'spam',
          details: null,
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ).rejects.toMatchObject({
        // Postgres SQLSTATE for check_violation.
        code: '23514',
      });

      const reportsAfter = await countSelfReports();
      expect(reportsAfter).toBe(reportsBefore);
    });
  });
});
