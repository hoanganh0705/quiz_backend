import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BOOKMARK_REPOSITORY_PORT,
  type BookmarkRepositoryPort,
  type RecentBookmarkRow,
  type RecentBookmarkCursor,
  type BookmarkStatusRow,
  type BookmarkSearchResult,
  type UserBookmarkStatsRow,
} from './ports/bookmark-repository.port';
import {
  BOOKMARK_COLLECTION_REPOSITORY_PORT,
  type BookmarkCollectionRepositoryPort,
} from './ports/bookmark-collection-repository.port';
import type { BookmarkCollectionAnalytics } from './types/bookmark-collection-analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  BookmarkCollectionNotFoundError,
  BookmarkValidationError,
  CollectionForbiddenError,
} from './errors';
import { ANALYTICS_CACHE_TTL_MS, COLLECTION_FORBIDDEN_MESSAGE } from '../bookmark.constants';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';
import {
  sliceWithCursor,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
} from './bookmark-cursor-pagination';

/**
 * BookmarkQueryService — Read operations for the Bookmark aggregate.
 *
 * Responsibilities:
 *  - List collections for a user
 *  - Get bookmark status for a quiz
 *  - Search and paginate bookmarks
 *  - Fetch collection analytics
 */
@Injectable()
export class BookmarkQueryService {
  constructor(
    @Inject(BOOKMARK_REPOSITORY_PORT)
    private readonly bookmarkRepository: BookmarkRepositoryPort,
    @Inject(BOOKMARK_COLLECTION_REPOSITORY_PORT)
    private readonly collectionRepository: BookmarkCollectionRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(BookmarkQueryService.name)
    private readonly logger: PinoLogger,
  ) {}

  async listCollections(user: JwtPayload) {
    return this.collectionRepository.listCollectionsByUser(user.sub);
  }

  async getBookmarkStatus(user: JwtPayload, quizId: string): Promise<BookmarkStatusRow> {
    return this.bookmarkRepository.getBookmarkStatus(user.sub, quizId);
  }

  async searchBookmarks(
    userId: string,
    query: { query: string; limit?: number; cursor?: RecentBookmarkCursor | null },
  ): Promise<BookmarkSearchResult> {
    const trimmed = query.query.trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      throw new BookmarkValidationError(
        `Search query must be at least ${SEARCH_MIN_LENGTH} characters`,
      );
    }
    if (trimmed.length > SEARCH_MAX_LENGTH) {
      throw new BookmarkValidationError(
        `Search query must be at most ${SEARCH_MAX_LENGTH} characters`,
      );
    }

    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.bookmarkRepository.searchBookmarks({
      userId,
      query: trimmed,
      limit,
      cursor,
    });

    const { items, hasNextPage, nextCursor } = sliceWithCursor(rows, limit);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor,
    };
  }

  async listBookmarksInCollection(collectionId: string, user: JwtPayload) {
    await this.verifyCollectionOwnership(collectionId, user);
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

    const { items, hasNextPage, nextCursor } = sliceWithCursor(rows, limit);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor,
    };
  }

  async getCollectionAnalytics(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkCollectionAnalytics> {
    await this.verifyCollectionOwnership(collectionId, user);

    const cacheKey = this.buildAnalyticsCacheKey(collectionId, user);

    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug({ event: 'analytics_cache_hit', collectionId });
        return JSON.parse(cached) as BookmarkCollectionAnalytics;
      }
    } catch (error) {
      this.logger.warn({
        event: 'analytics_cache_read_failed',
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.logger.debug({ event: 'analytics_cache_miss', collectionId });
    const analytics = await this.bookmarkRepository.getCollectionAnalytics(collectionId);

    if (!analytics) {
      throw new BookmarkCollectionNotFoundError();
    }

    try {
      await this.cache.set(cacheKey, JSON.stringify(analytics), ANALYTICS_CACHE_TTL_MS);
    } catch (error) {
      this.logger.warn({
        event: 'analytics_cache_write_failed',
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return analytics;
  }

  private buildAnalyticsCacheKey(collectionId: string, user: JwtPayload): string {
    const tenant = user.role === 'admin' ? `admin:${user.sub}` : `user:${user.sub}`;
    return `bookmark:collection:${collectionId}:analytics:${tenant}`;
  }

  async getMyBookmarkStats(user: JwtPayload): Promise<UserBookmarkStatsRow> {
    return this.bookmarkRepository.getUserBookmarkStats(user.sub);
  }

  private async verifyCollectionOwnership(collectionId: string, user: JwtPayload): Promise<void> {
    const collection = await this.collectionRepository.getCollectionById(collectionId);
    if (!collection) {
      throw new BookmarkCollectionNotFoundError();
    }
    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }
  }
}
