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
import type { BookmarkCollectionAnalytics } from './types/bookmark-collection-analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { BookmarkCollectionNotFoundError, CollectionForbiddenError } from './errors';
import { COLLECTION_FORBIDDEN_MESSAGE } from '../bookmark.constants';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';

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
  private static readonly ANALYTICS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    @Inject(BOOKMARK_REPOSITORY_PORT)
    private readonly bookmarkRepository: BookmarkRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(BookmarkQueryService.name)
    private readonly logger: PinoLogger,
  ) {}

  async listCollections(user: JwtPayload) {
    return this.bookmarkRepository.listCollectionsByUser(user.sub);
  }

  async getBookmarkStatus(user: JwtPayload, quizId: string): Promise<BookmarkStatusRow> {
    return this.bookmarkRepository.getBookmarkStatus(user.sub, quizId);
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

  async getCollectionAnalytics(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkCollectionAnalytics> {
    await this.verifyCollectionOwnership(collectionId, user);

    const cacheKey = `bookmark:collection:${collectionId}:analytics`;

    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug({ event: 'analytics_cache_hit', collectionId });
        return JSON.parse(cached) as BookmarkCollectionAnalytics;
      }
    } catch {
      // Cache errors are non-fatal — fall through to DB
    }

    this.logger.debug({ event: 'analytics_cache_miss', collectionId });
    const analytics = await this.bookmarkRepository.getCollectionAnalytics(collectionId);

    if (!analytics) {
      throw new BookmarkCollectionNotFoundError();
    }

    try {
      await this.cache.set(
        cacheKey,
        JSON.stringify(analytics),
        BookmarkQueryService.ANALYTICS_CACHE_TTL_MS,
      );
    } catch {
      // Cache write errors are non-fatal
    }

    return analytics;
  }

  async getMyBookmarkStats(userId: string): Promise<UserBookmarkStatsRow> {
    return this.bookmarkRepository.getUserBookmarkStats(userId);
  }

  private async verifyCollectionOwnership(collectionId: string, user: JwtPayload): Promise<void> {
    const collection = await this.bookmarkRepository.getCollectionById(collectionId);
    if (!collection) {
      throw new BookmarkCollectionNotFoundError();
    }
    if (collection.userId !== user.sub && user.role !== 'admin') {
      throw new CollectionForbiddenError(COLLECTION_FORBIDDEN_MESSAGE);
    }
  }
}
