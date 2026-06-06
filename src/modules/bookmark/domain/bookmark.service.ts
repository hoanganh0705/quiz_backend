import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BOOKMARK_REPOSITORY_PORT,
  type BookmarkRepositoryPort,
  type BookmarkCollectionRow,
  type UserBookmarkStatsRow,
  type RecentBookmarkRow,
  type RecentBookmarkCursor,
  type BookmarkStatusRow,
  type BookmarkSearchResult,
} from './ports/bookmark-repository.port';
import type { BookmarkCollectionAnalytics } from './types/bookmark-collection-analytics';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  CollectionNotFoundError,
  BookmarkCollectionNotFoundError,
  CollectionForbiddenError,
  CollectionConflictError,
  BookmarkNotFoundError,
  BookmarkConflictError,
  BookmarkAlreadyExistsError,
} from './errors';
import {
  COLLECTION_NOT_FOUND_MESSAGE,
  COLLECTION_FORBIDDEN_MESSAGE,
  COLLECTION_NAME_CONFLICT_MESSAGE,
  BOOKMARK_NOT_FOUND_MESSAGE,
  BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE,
} from '../bookmark.constants';
import { AnalyticsEventHandler } from '@/modules/quiz/domain/analytics/analytics-event-handler';

@Injectable()
export class BookmarkService {
  constructor(
    @Inject(BOOKMARK_REPOSITORY_PORT)
    private readonly bookmarkRepository: BookmarkRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (quizId: string) => Promise<{ quizId: string } | null>;
    },
    @Inject(forwardRef(() => AnalyticsEventHandler))
    private readonly analyticsEventHandler: AnalyticsEventHandler,
    @InjectPinoLogger(BookmarkService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getOwnedCollectionOrThrow(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkCollectionRow> {
    const collection = await this.bookmarkRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new CollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    return collection;
  }

  // ---------------------------------------------------------------------------
  // Collection operations
  // ---------------------------------------------------------------------------

  async listCollections(user: JwtPayload) {
    return this.bookmarkRepository.listCollectionsByUser(user.sub);
  }

  async getBookmarkStatus(userId: string, quizId: string): Promise<BookmarkStatusRow> {
    return this.bookmarkRepository.getBookmarkStatus(userId, quizId);
  }

  async searchBookmarks(
    userId: string,
    query: { query: string; limit?: number; cursor?: RecentBookmarkCursor | null },
  ): Promise<BookmarkSearchResult> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.bookmarkRepository.searchBookmarks({
      userId,
      query: query.query,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? {
              bookmarkedAt: lastItem.bookmarkedAt,
              bookmarkId: lastItem.bookmarkId,
            }
          : null,
    };
  }

  async createCollection(user: JwtPayload, name: string, description: string | null | undefined) {
    const nowIso = new Date().toISOString();

    try {
      const collection = await this.bookmarkRepository.createCollection({
        userId: user.sub,
        name,
        description: description ?? null,
        nowIso,
      });

      this.logger.info({
        event: 'collection_created',
        collectionId: collection.collectionId,
        userId: user.sub,
      });

      return collection;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_collections_user_name') {
        this.logger.warn({ event: 'collection_create_name_conflict', userId: user.sub, name });
        throw new CollectionConflictError(COLLECTION_NAME_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async updateCollection(
    collectionId: string,
    user: JwtPayload,
    name: string | undefined,
    description: string | null | undefined,
  ) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const nowIso = new Date().toISOString();

    try {
      const updated = await this.bookmarkRepository.updateCollection({
        collectionId,
        name,
        description,
        nowIso,
      });

      this.logger.info({
        event: 'collection_updated',
        collectionId,
        userId: user.sub,
      });

      return updated;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmark_collections_user_name') {
        this.logger.warn({ event: 'collection_update_name_conflict', userId: user.sub, name });
        throw new CollectionConflictError(COLLECTION_NAME_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async deleteCollection(collectionId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    await this.bookmarkRepository.deleteCollection(collectionId);

    this.logger.info({
      event: 'collection_deleted',
      collectionId,
      userId: user.sub,
    });
  }

  // ---------------------------------------------------------------------------
  // Bookmark operations
  // ---------------------------------------------------------------------------

  async addBookmark(
    collectionId: string,
    quizId: string,
    notes: string | null | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    await this.getOwnedCollectionOrThrow(collectionId, user);

    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    if (!quiz) {
      throw new CollectionNotFoundError('Quiz not found');
    }

    try {
      const bookmark = await this.bookmarkRepository.addQuizToCollection({
        collectionId,
        quizId,
        notes: notes ?? null,
        nowIso,
      });

      this.logger.info({
        event: 'quiz_bookmarked',
        collectionId,
        quizId,
        userId: user.sub,
      });

      // Refresh quiz analytics
      await this.analyticsEventHandler.onBookmarkAdded(quizId);

      return bookmark;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_bookmarked_quizzes_pair') {
        this.logger.warn({
          event: 'bookmark_duplicate',
          collectionId,
          quizId,
          userId: user.sub,
        });
        throw new BookmarkConflictError(BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE);
      }
      throw error;
    }
  }

  async addBookmarksBulk(userId: string, collectionId: string, quizIds: string[]): Promise<number> {
    const user = { sub: userId, role: 'user' } as JwtPayload;
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const uniqueQuizIds = [...new Set(quizIds)];
    if (uniqueQuizIds.length === 0) {
      return 0;
    }

    const nowIso = new Date().toISOString();
    const addedCount = await this.bookmarkRepository.addBookmarksBulk({
      userId,
      collectionId,
      quizIds: uniqueQuizIds,
      nowIso,
    });

    this.logger.info({
      event: 'bulk_bookmarks_added',
      collectionId,
      userId,
      requestedCount: quizIds.length,
      uniqueCount: uniqueQuizIds.length,
      addedCount,
    });

    return addedCount;
  }

  async removeBookmarksBulk(userId: string, collectionId: string, quizIds: string[]): Promise<number> {
    const user = { sub: userId, role: 'user' } as JwtPayload;
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const uniqueQuizIds = [...new Set(quizIds)];
    if (uniqueQuizIds.length === 0) {
      return 0;
    }

    const removedCount = await this.bookmarkRepository.removeBookmarksBulk({
      userId,
      collectionId,
      quizIds: uniqueQuizIds,
    });

    this.logger.info({
      event: 'bulk_bookmarks_removed',
      collectionId,
      userId,
      requestedCount: quizIds.length,
      uniqueCount: uniqueQuizIds.length,
      removedCount,
    });

    return removedCount;
  }

  async removeBookmark(collectionId: string, quizId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    const existing = await this.bookmarkRepository.getBookmarkedQuiz(collectionId, quizId);
    if (!existing) {
      throw new BookmarkNotFoundError(BOOKMARK_NOT_FOUND_MESSAGE);
    }

    await this.bookmarkRepository.removeBookmark(collectionId, quizId);

    this.logger.info({
      event: 'quiz_unbookmarked',
      collectionId,
      quizId,
      userId: user.sub,
    });

    // Refresh quiz analytics
    await this.analyticsEventHandler.onBookmarkRemoved(quizId);
  }

  async moveBookmark(
    userId: string,
    sourceCollectionId: string,
    targetCollectionId: string,
    quizId: string,
  ): Promise<void> {
    const sourceCollection = await this.bookmarkRepository.getCollectionById(sourceCollectionId);
    if (!sourceCollection) {
      throw new BookmarkCollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (sourceCollection.userId !== userId) {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    const targetCollection = await this.bookmarkRepository.getCollectionById(targetCollectionId);
    if (!targetCollection) {
      throw new BookmarkCollectionNotFoundError(COLLECTION_NOT_FOUND_MESSAGE);
    }

    if (targetCollection.userId !== userId) {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }

    const existingSourceBookmark = await this.bookmarkRepository.getBookmarkedQuiz(
      sourceCollectionId,
      quizId,
    );
    if (!existingSourceBookmark) {
      throw new BookmarkNotFoundError(BOOKMARK_NOT_FOUND_MESSAGE);
    }

    const existingTargetBookmark = await this.bookmarkRepository.getBookmarkedQuiz(
      targetCollectionId,
      quizId,
    );
    if (existingTargetBookmark) {
      throw new BookmarkAlreadyExistsError(BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE);
    }

    const nowIso = new Date().toISOString();
    await this.bookmarkRepository.moveBookmark({
      userId,
      sourceCollectionId,
      targetCollectionId,
      quizId,
      nowIso,
    });

    this.logger.info({
      event: 'bookmark_moved',
      userId,
      sourceCollectionId,
      targetCollectionId,
      quizId,
    });
  }

  async listBookmarksInCollection(collectionId: string, user: JwtPayload) {
    await this.getOwnedCollectionOrThrow(collectionId, user);

    return this.bookmarkRepository.listBookmarksInCollection(collectionId);
  }

  async getRecentBookmarks(
    userId: string,
    query: { limit?: number; cursor?: RecentBookmarkCursor | null },
  ): Promise<{
    items: RecentBookmarkRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: RecentBookmarkCursor | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.bookmarkRepository.listRecentBookmarks({
      userId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? {
              bookmarkedAt: lastItem.bookmarkedAt,
              bookmarkId: lastItem.bookmarkId,
            }
          : null,
    };
  }

  async getCollectionAnalytics(collectionId: string): Promise<BookmarkCollectionAnalytics> {
    const collection = await this.bookmarkRepository.getCollectionById(collectionId);

    if (!collection) {
      throw new BookmarkCollectionNotFoundError();
    }

    const analytics = await this.bookmarkRepository.getCollectionAnalytics(collectionId);

    if (!analytics) {
      throw new BookmarkCollectionNotFoundError();
    }

    return analytics;
  }

  async getMyBookmarkStats(userId: string): Promise<UserBookmarkStatsRow> {
    return this.bookmarkRepository.getUserBookmarkStats(userId);
  }
}
