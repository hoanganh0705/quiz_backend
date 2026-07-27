/// <reference types="jest" />
/**
 * Counter reconciliation drift canary (Fix #8, ADR-0017).
 *
 * Runs every counter's recompute entry point against the live Postgres
 * instance, then asserts the cached column equals the source-of-truth
 * aggregate via direct SQL. Reports zero drift or a precise list of the
 * counters that diverged. Designed for CI on every PR: any future schema
 * change that breaks a counter's recompute path will surface here, not in
 * production.
 *
 * Scope is intentionally limited to counters whose recompute entry point is
 * already in the codebase:
 *
 *   - `quiz_stats.total_attempts` / `total_players` / `avg_score_percent` /
 *     `completion_rate`           ← `reconcileAllQuizMetrics` (Fix #7)
 *   - `quiz_stats.avg_rating` / `rating_count`
 *                                    ← `rebuildAllMetrics` (weekly cron)
 *   - `quiz_stats.bookmark_count`  ← `refreshBookmarkMetrics` + Fix #5 semantic
 *
 * Counters the audit classified HIGH-risk but which still need their own
 * service path (e.g. `tournament_participants.total_score`,
 * `discussion_threads.comments_count`, `users.current_streak`) are not
 * asserted here — those are governed by their own `reconcile-*.e2e-spec.ts`
 * and the audit doc.
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PinoLogger } from 'nestjs-pino';
import { Pool } from 'pg';
import type { DrizzleDB } from '@/core/database/database.module';
import * as schema from '@/core/database/schema';
import { quizStats } from '@/core/database/schema';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics/quiz-analytics.service';
import { QuizAnalyticsRepository } from '@/modules/quiz/domain/analytics/quiz-analytics.repository';
import { PopularityService } from '@/modules/quiz/domain/analytics/popularity.service';
import { TrendingService } from '@/modules/quiz/domain/analytics/trending.service';
import { MetricsRepository } from '@/modules/quiz/infrastructure/repositories/metrics.repository';

function createLogger(context: string): PinoLogger {
  const logger = new PinoLogger({ pinoHttp: { level: 'silent' } });
  logger.setContext(context);
  return logger;
}

type DriftRow = {
  quizId: string;
  counter: string;
  cached: string;
  source: string;
};

describe('Counter reconciliation drift canary (Fix #8 / ADR-0017)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[counter-reconciliation-drift] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('counter-reconciliation-drift', () => {
    let pool: Pool;
    let db: DrizzleDB;
    let analyticsService: QuizAnalyticsService;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;

      const metricsRepository = new MetricsRepository(db, createLogger(MetricsRepository.name));
      const analyticsRepository = new QuizAnalyticsRepository(db);
      analyticsService = new QuizAnalyticsService(
        analyticsRepository,
        metricsRepository,
        new TrendingService(metricsRepository, createLogger(TrendingService.name)),
        new PopularityService(metricsRepository, db, createLogger(PopularityService.name)),
        createLogger(QuizAnalyticsService.name),
      );
    });

    afterAll(async () => {
      if (pool) {
        await pool.end();
      }
    });

    /**
     * Recompute every quiz's cached counter, then for each quiz compare the
     * cached value to a freshly issued aggregate SQL statement over the
     * source-of-truth tables. Returns the rows that disagree.
     *
     * Two service entry points are exercised:
     *   - `reconcileAllQuizMetrics` runs `refreshQuizMetrics` for every quiz
     *     and converges the attempt/avg_score/completion_rate counters.
     *   - `rebuildAllMetrics` is the existing weekly full rebuild. It also
     *     converges the review counters (`avg_rating`, `rating_count`),
     *     which `reconcileAllQuizMetrics` deliberately does not touch
     *     today (see ADR-0017 §"Defense-in-depth periodic reconciliation").
     */
    async function detectDrift(): Promise<DriftRow[]> {
      const summary = await analyticsService.reconcileAllQuizMetrics();
      expect(summary.errorCount).toBe(0);
      expect(summary.quizzesRefreshed).toBeGreaterThan(0);

      // `rebuildAllMetrics` does its own logging; it's the same code path
      // the Sunday @Cron hits in production. Calling it here ensures the
      // drift canary covers every counter in scope, including the review
      // aggregates that live behind a different service entry point.
      await analyticsService.rebuildAllMetrics();

      const result = await db.execute<{
        quiz_id: string;
        cached_total_attempts: string;
        cached_total_players: string;
        cached_avg_score_percent: string;
        cached_completion_rate: string;
        cached_avg_rating: string;
        cached_rating_count: string;
        src_total_attempts: string;
        src_total_players: string;
        src_avg_score_percent: string | null;
        src_completion_rate: string | null;
        src_avg_rating: string | null;
        src_rating_count: string;
      }>(sql`
        SELECT
          qs.quiz_id,
          qs.total_attempts::text                                            AS cached_total_attempts,
          qs.total_players::text                                            AS cached_total_players,
          qs.avg_score_percent::text                                        AS cached_avg_score_percent,
          qs.completion_rate::text                                          AS cached_completion_rate,
          qs.avg_rating::text                                               AS cached_avg_rating,
          qs.rating_count::text                                             AS cached_rating_count,
          COALESCE((
            SELECT COUNT(*)::text
            FROM quiz_attempts qa
            JOIN quiz_versions qv ON qa.quiz_version_id = qv.quiz_version_id
            WHERE qv.quiz_id = qs.quiz_id
              AND qa.status = 'completed'
          ), '0')                                                            AS src_total_attempts,
          COALESCE((
            SELECT COUNT(DISTINCT qa.user_id)::text
            FROM quiz_attempts qa
            JOIN quiz_versions qv ON qa.quiz_version_id = qv.quiz_version_id
            WHERE qv.quiz_id = qs.quiz_id
              AND qa.status = 'completed'
          ), '0')                                                            AS src_total_players,
          (
            SELECT AVG(qa.score_percent)::text
            FROM quiz_attempts qa
            JOIN quiz_versions qv ON qa.quiz_version_id = qv.quiz_version_id
            WHERE qv.quiz_id = qs.quiz_id
              AND qa.status = 'completed'
          )                                                                  AS src_avg_score_percent,
          (
            SELECT
              CASE
                WHEN COUNT(*) FILTER (WHERE qa.status IN ('started','completed')) = 0
                THEN '0.00'
                ELSE ROUND(
                  COUNT(*) FILTER (WHERE qa.status = 'completed')::numeric
                  / COUNT(*) FILTER (WHERE qa.status IN ('started','completed'))::numeric * 100,
                  2
                )::text
              END
            FROM quiz_attempts qa
            JOIN quiz_versions qv ON qa.quiz_version_id = qv.quiz_version_id
            WHERE qv.quiz_id = qs.quiz_id
          )                                                                  AS src_completion_rate,
          COALESCE((
            SELECT AVG(qr.rating)::text
            FROM quiz_reviews qr
            WHERE qr.quiz_id = qs.quiz_id
          ), '0')                                                            AS src_avg_rating,
          COALESCE((
            SELECT COUNT(*)::text
            FROM quiz_reviews qr
            WHERE qr.quiz_id = qs.quiz_id
          ), '0')                                                            AS src_rating_count
        FROM quiz_stats qs
      `);
      type DriftSqlRow = {
        quiz_id: string;
        cached_total_attempts: string;
        cached_total_players: string;
        cached_avg_score_percent: string;
        cached_completion_rate: string;
        cached_avg_rating: string;
        cached_rating_count: string;
        src_total_attempts: string;
        src_total_players: string;
        src_avg_score_percent: string | null;
        src_completion_rate: string | null;
        src_avg_rating: string | null;
        src_rating_count: string;
      };

      const rows = (result.rows as unknown as DriftSqlRow[]) ?? [];

      const drift: DriftRow[] = [];
      const COUNT_TOLERANCE = 0;
      const AVERAGE_TOLERANCE = 0.01;

      const differs = (cached: string, source: string, tolerance: number): boolean => {
        const c = Number(cached);
        const s = Number(source);
        if (!Number.isFinite(c) || !Number.isFinite(s)) return cached !== source;
        return Math.abs(c - s) > tolerance;
      };

      for (const row of rows) {
        const comparisons: Array<{
          counter: string;
          cached: string;
          source: string;
          tolerance: number;
        }> = [
          {
            counter: 'total_attempts',
            cached: row.cached_total_attempts,
            source: row.src_total_attempts,
            tolerance: COUNT_TOLERANCE,
          },
          {
            counter: 'total_players',
            cached: row.cached_total_players,
            source: row.src_total_players,
            tolerance: COUNT_TOLERANCE,
          },
          {
            counter: 'avg_score_percent',
            cached: row.cached_avg_score_percent,
            source: row.src_avg_score_percent ?? '0',
            tolerance: AVERAGE_TOLERANCE,
          },
          {
            counter: 'completion_rate',
            cached: row.cached_completion_rate,
            source: row.src_completion_rate ?? '0',
            tolerance: AVERAGE_TOLERANCE,
          },
          {
            counter: 'avg_rating',
            cached: row.cached_avg_rating,
            source: row.src_avg_rating ?? '0',
            tolerance: AVERAGE_TOLERANCE,
          },
          {
            counter: 'rating_count',
            cached: row.cached_rating_count,
            source: row.src_rating_count,
            tolerance: COUNT_TOLERANCE,
          },
        ];

        for (const { counter, cached, source, tolerance } of comparisons) {
          if (differs(cached, source, tolerance)) {
            drift.push({
              quizId: row.quiz_id,
              counter,
              cached,
              source,
            });
          }
        }
      }
      return drift;
    }

    it('reconciles quiz_stats.counters to match the source-of-truth aggregates with zero drift', async () => {
      const drift = await detectDrift();
      if (drift.length > 0) {
        // Format the drift as a tab-separated block so the failure output is
        // easy to grep in CI logs.
        const lines = drift.map(
          (d) => `  ${d.quizId}\t${d.counter}\tcached=${d.cached}\tsource=${d.source}`,
        );
        throw new Error(
          `Counter drift detected (${drift.length} counters disagree with source-of-truth):\n${lines.join('\n')}`,
        );
      }
      expect(drift).toHaveLength(0);
    });

    it('bookmark_count is consistent with COUNT(DISTINCT user_id) of bookmarked_quizzes joined to collections', async () => {
      // Bookmark semantic lives behind refreshBookmarkMetrics which Fix #5
      // wired to COUNT(DISTINCT bc.user_id). Verify the cached column by
      // re-querying the same semantic SQL the service uses.
      const ids = await db.select({ quizId: quizStats.quizId }).from(quizStats);
      expect(ids.length).toBeGreaterThan(0);

      for (const { quizId } of ids) {
        const bookmarkResult = await db.execute<{ src: string }>(sql`
          SELECT COALESCE(COUNT(DISTINCT bc.user_id)::text, '0') AS src
          FROM bookmarked_quizzes bq
          INNER JOIN bookmark_collections bc
            ON bq.collection_id = bc.collection_id
          WHERE bq.quiz_id = ${quizId}::uuid
        `);
        const bookmarkRows = (bookmarkResult as unknown as { rows: Array<{ src: string }> }).rows;
        const src = bookmarkRows[0]?.src ?? '0';

        const [row] = await db
          .select({ bookmarkCount: quizStats.bookmarkCount })
          .from(quizStats)
          .where(eq(quizStats.quizId, quizId));
        // bookmark_count is recomputed from bookmark events emitted by
        // BookmarkCommandService.addBookmark / removeBookmark / bulk paths
        // (Fix #6). For seed quizzes with no event traffic, the cached value
        // is 0 only if no bookmark exists in the DB. Validate that.
        expect(Number(row?.bookmarkCount ?? 0)).toBe(Number(src));
      }
    });
  });
});
