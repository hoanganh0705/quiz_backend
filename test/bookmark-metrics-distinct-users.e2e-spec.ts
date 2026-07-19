/// <reference types="jest" />
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PinoLogger } from 'nestjs-pino';
import { Pool } from 'pg';
import type { DrizzleDB } from '@/core/database/database.module';
import * as schema from '@/core/database/schema';
import {
  bookmarkCollections,
  bookmarkedQuizzes,
  quizzes,
  quizStats,
  users,
} from '@/core/database/schema';
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

describe('Bookmark metric distinct-user semantics (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[bookmark-metrics-distinct-users] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('bookmark-metrics-distinct-users', () => {
    let pool: Pool;
    let db: DrizzleDB;
    let quizId: string;
    let userIds: string[] = [];
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
          [1, 2].map((sequence) => ({
            email: `bookmark-metric-${stamp}-${sequence}@quiz.local`,
            username: `bookmark_metric_${stamp.replaceAll('-', '_')}_${sequence}`,
            passwordHash: 'not-used-by-this-test',
            role: 'user' as const,
            isVerified: true,
          })),
        )
        .returning({ userId: users.userId });
      userIds = createdUsers.map((row) => row.userId);

      const [quiz] = await db
        .insert(quizzes)
        .values({
          title: `Bookmark metric ${stamp}`,
          slug: `bookmark-metric-${stamp}`,
        })
        .returning({ quizId: quizzes.quizId });
      quizId = quiz.quizId;

      const collections = await db
        .insert(bookmarkCollections)
        .values([
          { userId: userIds[0], name: `Primary ${stamp}` },
          { userId: userIds[0], name: `Secondary ${stamp}` },
          { userId: userIds[1], name: `Other owner ${stamp}` },
        ])
        .returning({ collectionId: bookmarkCollections.collectionId });

      await db.insert(bookmarkedQuizzes).values(
        collections.map(({ collectionId }) => ({
          collectionId,
          quizId,
        })),
      );
    });

    afterAll(async () => {
      if (quizId) {
        await db.delete(quizzes).where(eq(quizzes.quizId, quizId));
      }
      for (const userId of userIds) {
        await db.delete(users).where(eq(users.userId, userId));
      }
      if (pool) {
        await pool.end();
      }
    });

    it('counts distinct collection owners in MetricsRepository', async () => {
      await expect(metricsRepository.calculateBookmarkCount(quizId)).resolves.toBe(2);
    });

    it('counts distinct collection owners in QuizAnalyticsRepository', async () => {
      await expect(analyticsRepository.aggregateBookmarksByQuiz(quizId)).resolves.toBe(2);
    });

    it('replaces a drifted quiz_stats bookmark count through refreshBookmarkMetrics', async () => {
      await analyticsRepository.upsertQuizStats(quizId, { bookmarkCount: 999 });

      await analyticsService.refreshBookmarkMetrics(quizId);

      const [stats] = await db
        .select({ bookmarkCount: quizStats.bookmarkCount })
        .from(quizStats)
        .where(eq(quizStats.quizId, quizId));
      expect(stats?.bookmarkCount).toBe(2);
    });
  });
});
