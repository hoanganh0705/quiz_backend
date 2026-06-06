import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { BookmarkStatusRow, RecentBookmarkCursor } from '../domain/ports';
import { BookmarkService } from '../domain/bookmark.service';
import { BookmarkResponseMapper } from '../mappers/bookmark-response.mapper';
import { BookmarkStatsResponseMapper } from '../mappers/bookmark-stats-response.mapper';
import { BookmarkCollectionAnalyticsResponseMapper } from '../mappers/bookmark-collection-analytics-response.mapper';
import { RecentBookmarkCursorMapper } from '../mappers/recent-bookmark-cursor.mapper';
import { BookmarkSearchCursorMapper } from '../mappers/bookmark-search-cursor.mapper';
import { CreateCollectionDto, AddBookmarkDto, UpdateCollectionDto } from '../dto/request';

import {
  BookmarkCollectionListResponseDto,
  CreateCollectionResponseDto,
  AddBookmarkResponseDto,
  BulkAddBookmarksResponseDto,
  BulkRemoveBookmarksResponseDto,
  BookmarkListResponseDto,
  SearchBookmarksResponseDto,
  RemoveBookmarkResponseDto,
  MoveBookmarkResponseDto,
  UpdateCollectionResponseDto,
  DeleteCollectionResponseDto,
  BookmarkStatsResponseDto,
  RecentBookmarksResponseDto,
  BookmarkCollectionAnalyticsResponseDto,
} from '../dto/response';

@Injectable()
export class BookmarkApplicationService {
  constructor(
    private readonly bookmarkService: BookmarkService,
    private readonly bookmarkResponseMapper: BookmarkResponseMapper,
    private readonly bookmarkStatsResponseMapper: BookmarkStatsResponseMapper,
  ) {}

  async listCollections(user: JwtPayload): Promise<BookmarkCollectionListResponseDto> {
    const rows = await this.bookmarkService.listCollections(user);

    return {
      items: rows.map((row) => this.bookmarkResponseMapper.toCollectionResponse(row)),
    };
  }

  async getBookmarkStatus(userId: string, quizId: string): Promise<BookmarkStatusRow> {
    return this.bookmarkService.getBookmarkStatus(userId, quizId) as Promise<BookmarkStatusRow>;
  }

  async searchBookmarks(
    userId: string,
    query: {
      q: string;
      limit?: number;
      cursor?: RecentBookmarkCursor | null;
    },
  ): Promise<SearchBookmarksResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.bookmarkService.searchBookmarks(
      userId,
      {
        query: query.q,
        limit: query.limit,
        cursor: query.cursor ?? null,
      },
    );

    return {
      items: items.map((item) => ({
        quizId: item.quizId,
        title: item.title,
        slug: item.slug,
        imageUrl: item.imageUrl,
        collectionId: item.collectionId,
        collectionName: item.collectionName,
        bookmarkedAt: item.bookmarkedAt,
      })),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? BookmarkSearchCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getRecentBookmarks(
    userId: string,
    query: { limit?: number; cursor?: { bookmarkedAt: string; bookmarkId: string } | null },
  ): Promise<RecentBookmarksResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.bookmarkService.getRecentBookmarks(
      userId,
      query,
    );

    return {
      items: items.map((item) => ({
        quizId: item.quizId,
        title: item.title,
        slug: item.slug,
        imageUrl: item.imageUrl,
        collectionId: item.collectionId,
        collectionName: item.collectionName,
        bookmarkedAt: item.bookmarkedAt,
      })),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? RecentBookmarkCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async createCollection(
    user: JwtPayload,
    payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    const collection = await this.bookmarkService.createCollection(
      user,
      payload.name,
      payload.description,
    );

    return this.bookmarkResponseMapper.toCreateCollectionResponse(collection);
  }

  async addBookmark(
    collectionId: string,
    payload: AddBookmarkDto,
    user: JwtPayload,
  ): Promise<AddBookmarkResponseDto> {
    const bookmark = await this.bookmarkService.addBookmark(
      collectionId,
      payload.quizId,
      payload.notes,
      user,
    );

    return this.bookmarkResponseMapper.toAddBookmarkResponse(bookmark);
  }

  async addBookmarksBulk(
    userId: string,
    collectionId: string,
    quizIds: string[],
  ): Promise<BulkAddBookmarksResponseDto> {
    return {
      addedCount: Number(
        await this.bookmarkService.addBookmarksBulk(userId, collectionId, quizIds),
      ),
    };
  }

  async removeBookmarksBulk(
    userId: string,
    collectionId: string,
    quizIds: string[],
  ): Promise<BulkRemoveBookmarksResponseDto> {
    return {
      removedCount: Number(
        await this.bookmarkService.removeBookmarksBulk(userId, collectionId, quizIds),
      ),
    };
  }

  async removeBookmark(
    collectionId: string,
    quizId: string,
    user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    await this.bookmarkService.removeBookmark(collectionId, quizId, user);

    return { message: 'Bookmark removed successfully' };
  }

  async listBookmarksInCollection(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    const rows = await this.bookmarkService.listBookmarksInCollection(collectionId, user);

    return {
      items: rows.map((row) => this.bookmarkResponseMapper.toBookmarkedQuizResponse(row)),
    };
  }

  async getCollectionAnalytics(
    collectionId: string,
  ): Promise<BookmarkCollectionAnalyticsResponseDto> {
    const analytics = await this.bookmarkService.getCollectionAnalytics(collectionId);
    return BookmarkCollectionAnalyticsResponseMapper.toResponse(analytics);
  }

  async moveBookmark(
    userId: string,
    sourceCollectionId: string,
    payload: { quizId: string; targetCollectionId: string },
  ): Promise<MoveBookmarkResponseDto> {
    const { targetCollectionId, quizId } = payload;

    await this.bookmarkService.moveBookmark(userId, sourceCollectionId, targetCollectionId, quizId);

    return { message: 'Bookmark moved successfully' };
  }

  async updateCollection(
    collectionId: string,
    payload: UpdateCollectionDto,
    user: JwtPayload,
  ): Promise<UpdateCollectionResponseDto> {
    const collection = await this.bookmarkService.updateCollection(
      collectionId,
      user,
      payload.name,
      payload.description,
    );

    return this.bookmarkResponseMapper.toUpdateCollectionResponse(collection);
  }

  async deleteCollection(
    collectionId: string,
    user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    await this.bookmarkService.deleteCollection(collectionId, user);

    return { message: 'Collection deleted successfully' };
  }

  async getMyBookmarkStats(user: JwtPayload): Promise<BookmarkStatsResponseDto> {
    const stats = await this.bookmarkService.getMyBookmarkStats(user.sub);
    return this.bookmarkStatsResponseMapper.toResponse(stats);
  }
}
