import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { BookmarkStatusRow, RecentBookmarkCursor } from '../domain/ports';
import { BookmarkQueryService } from '../domain/bookmark-query.service';
import { BookmarkCommandService } from '../domain/bookmark-command.service';
import { BookmarkResponseMapper } from '../mappers/bookmark-response.mapper';
import { BookmarkStatsResponseMapper } from '../mappers/bookmark-stats-response.mapper';
import { BookmarkCollectionAnalyticsResponseMapper } from '../mappers/bookmark-collection-analytics-response.mapper';
import { BookmarkCursorMapper } from '../mappers/bookmark-cursor.mapper';
import {
  CreateCollectionDto,
  AddBookmarkDto,
  UpdateCollectionDto,
  UpdateBookmarkDto,
} from '../dto/request';

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
  UpdateBookmarkResponseDto,
} from '../dto/response';

@Injectable()
export class BookmarkApplicationService {
  constructor(
    private readonly bookmarkQueryService: BookmarkQueryService,
    private readonly bookmarkCommandService: BookmarkCommandService,
    private readonly bookmarkResponseMapper: BookmarkResponseMapper,
    private readonly bookmarkStatsResponseMapper: BookmarkStatsResponseMapper,
    @InjectPinoLogger(BookmarkApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async listCollections(user: JwtPayload): Promise<BookmarkCollectionListResponseDto> {
    this.logger.debug({ event: 'app_list_collections', userId: user.sub });
    const rows = await this.bookmarkQueryService.listCollections(user);

    return {
      items: rows.map((row) => this.bookmarkResponseMapper.toCollectionResponse(row)),
    };
  }

  async getBookmarkStatus(user: JwtPayload, quizId: string): Promise<BookmarkStatusRow> {
    this.logger.debug({ event: 'app_get_bookmark_status', userId: user.sub, quizId });
    return this.bookmarkQueryService.getBookmarkStatus(user, quizId);
  }

  async searchBookmarks(
    userId: string,
    query: {
      q: string;
      limit?: number;
      cursor?: RecentBookmarkCursor | null;
    },
  ): Promise<SearchBookmarksResponseDto> {
    this.logger.debug({ event: 'app_search_bookmarks', userId, query: query.q });
    const { items, limit, hasNextPage, nextCursor } = await this.bookmarkQueryService.searchBookmarks(
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
        nextCursor: nextCursor ? BookmarkCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getRecentBookmarks(
    userId: string,
    query: { limit?: number; cursor?: { bookmarkedAt: string; bookmarkId: string } | null },
  ): Promise<RecentBookmarksResponseDto> {
    this.logger.debug({ event: 'app_get_recent_bookmarks', userId });
    const { items, limit, hasNextPage, nextCursor } = await this.bookmarkQueryService.getRecentBookmarks(
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
        nextCursor: nextCursor ? BookmarkCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async createCollection(
    user: JwtPayload,
    payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    this.logger.debug({ event: 'app_create_collection', userId: user.sub, name: payload.name });
    const collection = await this.bookmarkCommandService.createCollection(
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
    this.logger.debug({ event: 'app_add_bookmark', userId: user.sub, collectionId, quizId: payload.quizId });
    const bookmark = await this.bookmarkCommandService.addBookmark(
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
    this.logger.debug({ event: 'app_add_bookmarks_bulk', userId, collectionId, count: quizIds.length });
    return {
      addedCount: Number(
        await this.bookmarkCommandService.addBookmarksBulk(userId, collectionId, quizIds),
      ),
    };
  }

  async removeBookmarksBulk(
    userId: string,
    collectionId: string,
    quizIds: string[],
  ): Promise<BulkRemoveBookmarksResponseDto> {
    this.logger.debug({ event: 'app_remove_bookmarks_bulk', userId, collectionId, count: quizIds.length });
    return {
      removedCount: Number(
        await this.bookmarkCommandService.removeBookmarksBulk(userId, collectionId, quizIds),
      ),
    };
  }

  async removeBookmark(
    collectionId: string,
    quizId: string,
    user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    this.logger.debug({ event: 'app_remove_bookmark', userId: user.sub, collectionId, quizId });
    await this.bookmarkCommandService.removeBookmark(collectionId, quizId, user);

    return { message: 'Bookmark removed successfully' };
  }

  async updateBookmark(
    collectionId: string,
    quizId: string,
    payload: UpdateBookmarkDto,
    user: JwtPayload,
  ): Promise<UpdateBookmarkResponseDto> {
    this.logger.debug({ event: 'app_update_bookmark', userId: user.sub, collectionId, quizId });
    const updated = await this.bookmarkCommandService.updateBookmark(
      collectionId,
      quizId,
      payload.notes,
      user,
    );

    return {
      bookmarkId: updated.bookmarkId,
      collectionId: updated.collectionId,
      quizId: updated.quizId,
      notes: updated.notes,
      updatedAt: updated.updatedAt,
    };
  }

  async listBookmarksInCollection(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    this.logger.debug({ event: 'app_list_bookmarks_in_collection', userId: user.sub, collectionId });
    const rows = await this.bookmarkQueryService.listBookmarksInCollection(collectionId, user);

    return {
      items: rows.map((row) => this.bookmarkResponseMapper.toBookmarkedQuizResponse(row)),
    };
  }

  async getCollectionAnalytics(
    collectionId: string,
    user: JwtPayload,
  ): Promise<BookmarkCollectionAnalyticsResponseDto> {
    this.logger.debug({ event: 'app_get_collection_analytics', userId: user.sub, collectionId });
    const analytics = await this.bookmarkQueryService.getCollectionAnalytics(collectionId, user);
    return BookmarkCollectionAnalyticsResponseMapper.toResponse(analytics);
  }

  async moveBookmark(
    userId: string,
    sourceCollectionId: string,
    payload: { quizId: string; targetCollectionId: string },
  ): Promise<MoveBookmarkResponseDto> {
    const { targetCollectionId, quizId } = payload;
    this.logger.debug({ event: 'app_move_bookmark', userId, sourceCollectionId, targetCollectionId, quizId });

    await this.bookmarkCommandService.moveBookmark(userId, sourceCollectionId, targetCollectionId, quizId);

    return { message: 'Bookmark moved successfully' };
  }

  async updateCollection(
    collectionId: string,
    payload: UpdateCollectionDto,
    user: JwtPayload,
  ): Promise<UpdateCollectionResponseDto> {
    this.logger.debug({ event: 'app_update_collection', userId: user.sub, collectionId });
    const collection = await this.bookmarkCommandService.updateCollection(
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
    this.logger.debug({ event: 'app_delete_collection', userId: user.sub, collectionId });
    await this.bookmarkCommandService.deleteCollection(collectionId, user);

    return { message: 'Collection deleted successfully' };
  }

  async getMyBookmarkStats(user: JwtPayload): Promise<BookmarkStatsResponseDto> {
    this.logger.debug({ event: 'app_get_my_bookmark_stats', userId: user.sub });
    const stats = await this.bookmarkQueryService.getMyBookmarkStats(user.sub);
    return this.bookmarkStatsResponseMapper.toResponse(stats);
  }
}
