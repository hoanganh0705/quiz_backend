/// <reference types="jest" />
/**
 * Fix #6 regression coverage — bulk bookmark mutations must emit per-row events
 * so the denormalized `quiz_stats.bookmark_count` reflects source-of-truth state.
 *
 * The `bookmarked_quizzes` table enforces a unique `(collection_id, quiz_id)` pair,
 * so three "rows for one quiz" inside a single collection is impossible — the test
 * asserts the realizable invariant: bulk-add three distinct quizzes in one collection
 * raises each quiz's distinct-owner count from 0 to 1, and bulk-remove drops each
 * back to 0. The analytics bridge runs asynchronously after each event, so the
 * test polls `quiz_stats.bookmark_count` until it matches.
 */
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
import { BookmarkRepository } from '@/modules/bookmark/infrastructure/repositories/bookmark.repository';
import { BookmarkCollectionRepository } from '@/modules/bookmark/infrastructure/repositories/bookmark-collection.repository';
import { BookmarkCommandService } from '@/modules/bookmark/domain/bookmark-command.service';
import { BookmarkDomainEventBus } from '@/modules/bookmark/domain/events/bookmark-domain.event-bus';
import { BookmarkAnalyticsEventHandler } from '@/modules/bookmark/domain/events/bookmark-analytics-event-handler.service';
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

describe('Bulk bookmark events refresh quiz_stats (e2e)', () => {
  const hasRequiredEnv = Boolean(process.env.DATABASE_URL);

  if (!hasRequiredEnv) {
    console.warn('[bookmark-bulk-events] missing DATABASE_URL; skipping suite.');
  }

  const suite = hasRequiredEnv ? describe : describe.skip;
  suite('bookmark-bulk-events', () => {
    let pool: Pool;
    let db: DrizzleDB;
    let ownerUserId: string;
    let otherUserIds: string[] = [];
    let quizIds: string[] = [];
    let collectionId: string;
    let commandService: BookmarkCommandService;
    let eventBus: BookmarkDomainEventBus;
    let analyticsServiceRef: { refreshBookmarkMetrics: (quizId: string) => Promise<void> };

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle(pool, { schema }) as unknown as DrizzleDB;

      const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

      const createdUsers = await db
        .insert(users)
        .values(
          [
            { sequence: 0, role: 'user' as const },
            { sequence: 1, role: 'user' as const },
          ].map(({ sequence, role }) => ({
            email: `bookmark-bulk-${stamp}-${sequence}@quiz.local`,
            username: `bookmark_bulk_${stamp.replaceAll('-', '_')}_${sequence}`,
            passwordHash: 'not-used-by-this-test',
            role,
            isVerified: true,
          })),
        )
        .returning({ userId: users.userId });

      ownerUserId = createdUsers[0].userId;
      otherUserIds = [createdUsers[1].userId];

      const createdQuizzes = await db
        .insert(quizzes)
        .values(
          [0, 1, 2].map((sequence) => ({
            title: `Bulk bookmark ${stamp} #${sequence}`,
            slug: `bulk-bookmark-${stamp}-${sequence}`,
          })),
        )
        .returning({ quizId: quizzes.quizId });
      quizIds = createdQuizzes.map((row) => row.quizId);

      const [collection] = await db
        .insert(bookmarkCollections)
        .values({
          userId: ownerUserId,
          name: `Bulk Add List ${stamp}`,
          description: null,
        })
        .returning({ collectionId: bookmarkCollections.collectionId });
      collectionId = collection.collectionId;

      const bookmarkRepository = new BookmarkRepository(db);
      const collectionRepository = new BookmarkCollectionRepository(db);
      eventBus = new BookmarkDomainEventBus(createLogger(BookmarkDomainEventBus.name));

      const metricsRepository = new MetricsRepository(db, createLogger(MetricsRepository.name));
      const analyticsRepository = new QuizAnalyticsRepository(db);
      const trendingService = new TrendingService(
        metricsRepository,
        createLogger(TrendingService.name),
      );
      const popularityService = new PopularityService(
        metricsRepository,
        db,
        createLogger(PopularityService.name),
      );
      analyticsServiceRef = new QuizAnalyticsService(
        analyticsRepository,
        metricsRepository,
        trendingService,
        popularityService,
        createLogger(QuizAnalyticsService.name),
      );

      new BookmarkAnalyticsEventHandler(
        { subscribe: eventBus.subscribe.bind(eventBus) } as never,
        analyticsServiceRef as never,
        createLogger(BookmarkAnalyticsEventHandler.name),
      ).onModuleInit();

      commandService = new BookmarkCommandService(
        bookmarkRepository,
        collectionRepository,
        {} as never,
        eventBus,
        createLogger(BookmarkCommandService.name),
      );
    });

    afterAll(async () => {
      if (quizIds.length > 0) {
        await db
          .delete(bookmarkedQuizzes)
          .where(eq(bookmarkedQuizzes.collectionId, collectionId));
      }
      if (collectionId) {
        await db.delete(bookmarkCollections).where(eq(bookmarkCollections.collectionId, collectionId));
      }
      if (quizIds.length > 0) {
        await db.delete(quizzes).where(eq(quizzes.quizId, quizIds[0]));
      }
      if (ownerUserId) {
        await db.delete(users).where(eq(users.userId, ownerUserId));
      }
      for (const userId of otherUserIds) {
        await db.delete(users).where(eq(users.userId, userId));
      }
      if (pool) {
        await pool.end();
      }
    });

    async function readBookmarkCount(quizId: string): Promise<number | null> {
      const [row] = await db
        .select({ bookmarkCount: quizStats.bookmarkCount })
        .from(quizStats)
        .where(eq(quizStats.quizId, quizId));
      return row ? Number(row.bookmarkCount) : null;
    }

    async function waitForBookmarkCount(
      quizId: string,
      expected: number,
      timeoutMs = 5_000,
    ): Promise<number> {
      const deadline = Date.now() + timeoutMs;
      let lastSeen: number | null = null;
      while (Date.now() < deadline) {
        lastSeen = await readBookmarkCount(quizId);
        if (lastSeen === expected) {
          return lastSeen;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        `Timed out waiting for quiz_stats.bookmark_count of ${quizId} to reach ${expected} (last seen ${lastSeen})`,
      );
    }

    it('emits one event per row added, refreshing quiz_stats for every distinct quiz', async () => {
      const addedCount = await commandService.addBookmarksBulk(
        ownerUserId,
        collectionId,
        quizIds,
      );
      expect(addedCount).toBe(3);

      for (const quizId of quizIds) {
        await expect(waitForBookmarkCount(quizId, 1)).resolves.toBe(1);
      }

      // Idempotent re-add must NOT double-count: the unique pair constraint turns the
      // insert into a no-op, no events are emitted, and quiz_stats stays at 1.
      const secondPass = await commandService.addBookmarksBulk(
        ownerUserId,
        collectionId,
        quizIds,
      );
      expect(secondPass).toBe(0);

      for (const quizId of quizIds) {
        await expect(waitForBookmarkCount(quizId, 1)).resolves.toBe(1);
      }

      const insertedRows = await db
        .select({
          bookmarkId: bookmarkedQuizzes.bookmarkId,
          quizId: bookmarkedQuizzes.quizId,
        })
        .from(bookmarkedQuizzes)
        .where(eq(bookmarkedQuizzes.collectionId, collectionId));
      expect(insertedRows).toHaveLength(3);
    });

    it('emits one event per row removed and drops quiz_stats back to 0', async () => {
      const removedCount = await commandService.removeBookmarksBulk(
        ownerUserId,
        collectionId,
        quizIds,
      );
      expect(removedCount).toBe(3);

      for (const quizId of quizIds) {
        await expect(waitForBookmarkCount(quizId, 0)).resolves.toBe(0);
      }

      const remaining = await db
        .select({ bookmarkId: bookmarkedQuizzes.bookmarkId })
        .from(bookmarkedQuizzes)
        .where(eq(bookmarkedQuizzes.collectionId, collectionId));
      expect(remaining).toHaveLength(0);
    });
  });
});
