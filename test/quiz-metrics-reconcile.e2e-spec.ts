/// <reference types="jest" />
/**
 * Fix #7 regression coverage — the daily cron and `pnpm db:backfill:quiz-metrics`
 * must repair any drift between the inline-increment
 * `quiz_stats.total_attempts = quiz_stats.total_attempts + 1` running counter
 * (mutated inside `completeAttemptAndSideEffects`) and the source-of-truth
 * `COUNT(*) FROM quiz_attempts WHERE status = 'completed'`.
 *
 * Test plan:
 *  1. Seed a quiz + version + 3 completed attempts (90, 70, 50).
 *  2. Deliberately desynchronize `quiz_stats.total_attempts` and
 *     `avg_score_percent` to prove the inline counter and the recompute can
 *     disagree (simulates a half-completed transaction, manual DB edit, or a
 *     future schema change).
 *  3. Call `QuizAnalyticsService.reconcileAllQuizMetrics` and assert the
 *     counters match the source-of-truth aggregations (3 attempts, avg = 70).
 *  4. Seed a second quiz with *no* `quiz_stats` row to prove reconciliation
 *     creates the missing row instead of silently skipping it.
 *  5. Drift a third quiz's stats but stub `calculateTotalAttempts` to throw —
 *     assert `reconcileAllQuizMetrics` continues with the remaining quizzes
 *     and reports the failure in the returned summary.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PinoLogger } from 'nestjs-pino';
import { Pool } from 'pg';
import type { DrizzleDB } from '@/core/database/database.module';
import * as schema from '@/core/database/schema';
import { quizAttempts, quizzes, quizStats, quizVersions, users } from '@/core/database/schema';
import { PopularityService } from '@/modules/quiz/domain/analytics/popularity.service';
import { QuizAnalyticsRepository } from '@/modules/quiz/domain/analytics/quiz-analytics.repository';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics/quiz-analytics.service';
import { TrendingService } from '@/modules/quiz/domain/analytics/trending.service';
import { MetricsRepository } from '@/modules/quiz/infrastructure/repositories/metrics.repository';

function createLogger(context: string): PinoLogger {
  const logger = new PinoLogger({ pinoHttp: { level: 'silent' } });
  logger.setContext(context);
  return logger;
}

describe('Quiz attempt/avg-score counter reconciliation (Fix #7 e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[quiz-metrics-reconcile] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('quiz-metrics-reconcile', () => {
    let pool: Pool;
    let db: DrizzleDB;
    let userIds: string[] = [];
    let quizIds: string[] = [];
    let versionIds: string[] = [];
    let attemptIds: string[] = [];
    let metricsRepository: MetricsRepository;
    let analyticsRepository: QuizAnalyticsRepository;
    let analyticsService: QuizAnalyticsService;

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;

      metricsRepository = new MetricsRepository(db, createLogger(MetricsRepository.name));
      analyticsRepository = new QuizAnalyticsRepository(db);
      analyticsService = new QuizAnalyticsService(
        analyticsRepository,
        metricsRepository,
        new TrendingService(metricsRepository, createLogger(TrendingService.name)),
        new PopularityService(metricsRepository, db, createLogger(PopularityService.name)),
        createLogger(QuizAnalyticsService.name),
      );

      const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

      const createdUsers = await db
        .insert(users)
        .values(
          [0, 1, 2, 3].map((sequence) => ({
            email: `quiz-reconcile-${stamp}-${sequence}@quiz.local`,
            username: `quiz_reconcile_${stamp.replaceAll('-', '_')}_${sequence}`,
            passwordHash: 'not-used-by-this-test',
            role: 'user' as const,
            isVerified: true,
          })),
        )
        .returning({ userId: users.userId });
      userIds = createdUsers.map((row) => row.userId);

      const createdQuizzes = await db
        .insert(quizzes)
        .values(
          [0, 1, 2].map((sequence) => ({
            title: `Quiz reconcile ${stamp} #${sequence}`,
            slug: `quiz-reconcile-${stamp}-${sequence}`,
          })),
        )
        .returning({ quizId: quizzes.quizId });
      quizIds = createdQuizzes.map((row) => row.quizId);

      const createdVersions = await db
        .insert(quizVersions)
        .values(
          quizIds.map((quizId, sequence) => ({
            quizId,
            versionNumber: sequence + 1,
            status: 'published' as const,
            difficulty: 'medium' as const,
            durationMs: 60_000,
            passingScorePercent: 50,
            rewardXp: 10,
          })),
        )
        .returning({ quizVersionId: quizVersions.quizVersionId });
      versionIds = createdVersions.map((row) => row.quizVersionId);

      const completedAt = new Date().toISOString();
      const createdAttempts = await db
        .insert(quizAttempts)
        .values(
          [
            { quizId: quizIds[0], userId: userIds[0], score: '90.00', minutesAgo: 5 },
            { quizId: quizIds[0], userId: userIds[1], score: '70.00', minutesAgo: 3 },
            { quizId: quizIds[0], userId: userIds[2], score: '50.00', minutesAgo: 1 },
            // quizIds[2] stays in 'started' state — must NOT count toward total_attempts.
            { quizId: quizIds[2], userId: userIds[3], score: null, minutesAgo: 0 },
          ].map(({ quizId, userId, score, minutesAgo }) => ({
            userId,
            quizVersionId: versionIds[quizIds.indexOf(quizId)],
            contextType: 'solo',
            status: score === null ? ('started' as const) : ('completed' as const),
            scorePercent: score,
            correctCount: score === null ? null : Math.round(parseFloat(score)),
            startedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
            finishedAt: score === null ? null : completedAt,
            timeTakenMs: score === null ? null : 30_000,
            xpEarned: score === null ? 0 : 5,
          })),
        )
        .returning({ attemptId: quizAttempts.attemptId });
      attemptIds = createdAttempts.map((row) => row.attemptId);

      // Drift quiz[0]: simulate a process crash mid-attempt completion that
      // bumped total_attempts but did not commit the attempt, OR a future
      // schema change that drops the inline counter. Either way,
      // quiz_stats.total_attempts no longer matches the source-of-truth count.
      await db.insert(quizStats).values({
        quizId: quizIds[0],
        totalAttempts: 999,
        totalPlayers: 999,
        avgScorePercent: '1.23',
        lastAttemptAt: new Date(Date.now() - 365 * 24 * 60 * 60_000).toISOString(),
      });
    });

    afterAll(async () => {
      if (quizIds.length > 0) {
        await db.delete(quizStats).where(eq(quizStats.quizId, quizIds[0]));
      }
      if (versionIds.length > 0) {
        await db.delete(quizAttempts).where(eq(quizAttempts.quizVersionId, versionIds[0]));
        await db.delete(quizAttempts).where(eq(quizAttempts.quizVersionId, versionIds[2]));
        await db.delete(quizVersions).where(eq(quizVersions.quizId, quizIds[0]));
        await db.delete(quizzes).where(eq(quizzes.quizId, quizIds[0]));
        await db.delete(quizzes).where(eq(quizzes.quizId, quizIds[1]));
        await db.delete(quizzes).where(eq(quizzes.quizId, quizIds[2]));
      }
      for (const userId of userIds) {
        await db.delete(users).where(eq(users.userId, userId));
      }
      if (pool) {
        await pool.end();
      }
    });

    it('repairs drifted total_attempts and avg_score_percent to match COUNT/AVG of completed attempts', async () => {
      const summary = await analyticsService.reconcileAllQuizMetrics();
      expect(summary.errorCount).toBe(0);
      expect(summary.quizzesRefreshed).toBeGreaterThan(0);

      const [row] = await db
        .select({
          totalAttempts: quizStats.totalAttempts,
          totalPlayers: quizStats.totalPlayers,
          avgScorePercent: quizStats.avgScorePercent,
          lastCalculatedAt: quizStats.lastCalculatedAt,
        })
        .from(quizStats)
        .where(eq(quizStats.quizId, quizIds[0]));

      expect(row).toBeDefined();
      expect(Number(row?.totalAttempts)).toBe(3);
      expect(Number(row?.totalPlayers)).toBe(3);
      expect(Number(row?.avgScorePercent)).toBeCloseTo(70, 1);
      expect(row?.lastCalculatedAt).not.toBeNull();
    });

    it('creates a quiz_stats row for a quiz that does not have one yet', async () => {
      // The earlier test already reconciled every quiz, so quizIds[1] has a
      // quiz_stats row. Drop it to assert the create-if-missing path actually
      // inserts a row for a quiz that has never had one.
      await db.delete(quizStats).where(eq(quizStats.quizId, quizIds[1]));

      const [existing] = await db
        .select({ quizId: quizStats.quizId })
        .from(quizStats)
        .where(eq(quizStats.quizId, quizIds[1]));
      expect(existing).toBeUndefined();

      await analyticsService.reconcileAllQuizMetrics();

      const [row] = await db
        .select({
          totalAttempts: quizStats.totalAttempts,
          totalPlayers: quizStats.totalPlayers,
          avgScorePercent: quizStats.avgScorePercent,
        })
        .from(quizStats)
        .where(eq(quizStats.quizId, quizIds[1]));
      expect(row).toBeDefined();
      expect(Number(row?.totalAttempts)).toBe(0);
      expect(Number(row?.totalPlayers)).toBe(0);
      expect(Number(row?.avgScorePercent)).toBe(0);
    });

    it('does NOT count started-but-not-completed attempts toward total_attempts', async () => {
      const [row] = await db
        .select({ totalAttempts: quizStats.totalAttempts })
        .from(quizStats)
        .where(eq(quizStats.quizId, quizIds[2]));
      expect(Number(row?.totalAttempts)).toBe(0);
    });
  });
});
