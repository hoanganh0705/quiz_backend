import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiCreatedResponse, ApiNotFoundResponse } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthCreate,
  ApiAuthUpdate,
  ApiAuthDelete,
  ApiAuthAction,
  ApiBadRequest,
  ApiForbidden,
  ApiInternalError,
  ApiConflict,
} from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { BookmarkApplicationService } from '../../application/bookmark.application.service';
import {
  CreateCollectionDto,
  AddBookmarkDto,
  BulkAddBookmarksDto,
  BulkRemoveBookmarksDto,
  UpdateCollectionDto,
  ListRecentBookmarksQueryDto,
  SearchBookmarksQueryDto,
  MoveBookmarkDto,
  UpdateBookmarkDto,
} from '../../dto/request';

import {
  BookmarkCollectionListResponseDto,
  CreateCollectionResponseDto,
  AddBookmarkResponseDto,
  BulkAddBookmarksResponseDto,
  BulkRemoveBookmarksResponseDto,
  BookmarkStatusResponseDto,
  RemoveBookmarkResponseDto,
  MoveBookmarkResponseDto,
  BookmarkListResponseDto,
  UpdateCollectionResponseDto,
  DeleteCollectionResponseDto,
  BookmarkStatsResponseDto,
  RecentBookmarksResponseDto,
  SearchBookmarksResponseDto,
  BookmarkCollectionAnalyticsResponseDto,
  UpdateBookmarkResponseDto,
} from '../../dto/response';

import { BookmarkDomainExceptionFilter } from '../filters/bookmark-domain-exception.filter';
import { BookmarkCursorMapper } from '../../mappers/bookmark-cursor.mapper';

@ApiTags('bookmarks')
@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('search')
  @ApiAuthList({
    description: 'Bookmark search results returned',
    type: SearchBookmarksResponseDto,
  })
  @ApiBadRequest()
  @ApiInternalError()
  async searchBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchBookmarksQueryDto,
  ): Promise<SearchBookmarksResponseDto> {
    return this.bookmarkApplicationService.searchBookmarks(user.sub, {
      q: query.q,
      limit: query.limit,
      cursor: query.cursor ? BookmarkCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('recent')
  @ApiAuthList({ description: 'Recent bookmarks returned', type: RecentBookmarksResponseDto })
  @ApiInternalError()
  async getRecentBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListRecentBookmarksQueryDto,
  ): Promise<RecentBookmarksResponseDto> {
    return this.bookmarkApplicationService.getRecentBookmarks(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? BookmarkCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('quizzes/:quizId/status')
  @ApiAuthList({
    description: 'Bookmark status returned for a bookmarked quiz',
    type: BookmarkStatusResponseDto,
  })
  @ApiInternalError()
  async getBookmarkStatus(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkStatusResponseDto> {
    return this.bookmarkApplicationService.getBookmarkStatus(user, quizId);
  }

  @Get('collections')
  @ApiAuthList({ description: 'Collections returned', type: BookmarkCollectionListResponseDto })
  @ApiInternalError()
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  @ApiAuthCreate({ description: 'Collection created', type: CreateCollectionResponseDto })
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  @Get('collections/:collectionId')
  @ApiAuthList({ description: 'Bookmarks returned', type: BookmarkListResponseDto })
  @ApiNotFoundResponse()
  @ApiInternalError()
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    return this.bookmarkApplicationService.listBookmarksInCollection(collectionId, user);
  }

  @Get('collections/:collectionId/analytics')
  @ApiAuthList({
    description: 'Bookmark collection analytics returned',
    type: BookmarkCollectionAnalyticsResponseDto,
  })
  @ApiNotFoundResponse()
  @ApiForbidden()
  @ApiInternalError()
  async getCollectionAnalytics(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionAnalyticsResponseDto> {
    return this.bookmarkApplicationService.getCollectionAnalytics(collectionId, user);
  }

  @Post('collections/:collectionId/quizzes')
  @ApiAuth()
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  @ApiCreatedResponse({ description: 'Bookmark added', type: AddBookmarkResponseDto })
  @ApiNotFoundResponse()
  @ApiConflict()
  @ApiBadRequest()
  @ApiInternalError()
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  @Post('collections/:collectionId/quizzes/bulk')
  @ApiAuthAction({ description: 'Bookmarks added in bulk', type: BulkAddBookmarksResponseDto })
  async addBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkAddBookmarksDto,
  ): Promise<BulkAddBookmarksResponseDto> {
    return this.bookmarkApplicationService.addBookmarksBulk(
      user.sub,
      collectionId,
      payload.quizIds,
    );
  }

  @Delete('collections/:collectionId/quizzes/bulk')
  @ApiAuthAction({ description: 'Bookmarks removed in bulk', type: BulkRemoveBookmarksResponseDto })
  async removeBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkRemoveBookmarksDto,
  ): Promise<BulkRemoveBookmarksResponseDto> {
    return this.bookmarkApplicationService.removeBookmarksBulk(
      user.sub,
      collectionId,
      payload.quizIds,
    );
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  @ApiAuthAction({ description: 'Bookmark removed', type: RemoveBookmarkResponseDto })
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }

  @Patch('collections/:collectionId/quizzes/:quizId')
  @ApiAuthUpdate({ description: 'Bookmark updated', type: UpdateBookmarkResponseDto })
  async updateBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateBookmarkDto,
  ): Promise<UpdateBookmarkResponseDto> {
    return this.bookmarkApplicationService.updateBookmark(collectionId, quizId, payload, user);
  }

  @Post('collections/:collectionId/move')
  @ApiAuthAction({ description: 'Bookmark moved', type: MoveBookmarkResponseDto })
  async moveBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: MoveBookmarkDto,
  ): Promise<MoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.moveBookmark(user.sub, collectionId, payload);
  }

  @Patch('collections/:collectionId')
  @ApiAuthUpdate({ description: 'Collection updated', type: UpdateCollectionResponseDto })
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateCollectionDto,
  ): Promise<UpdateCollectionResponseDto> {
    return this.bookmarkApplicationService.updateCollection(collectionId, payload, user);
  }

  @Get('me/stats')
  @ApiAuthList({ description: 'Bookmark statistics returned', type: BookmarkStatsResponseDto })
  @ApiInternalError()
  async getMyBookmarkStats(@CurrentUser() user: JwtPayload): Promise<BookmarkStatsResponseDto> {
    return this.bookmarkApplicationService.getMyBookmarkStats(user);
  }

  @Delete('collections/:collectionId')
  @ApiAuthDelete('Collection deleted')
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    return this.bookmarkApplicationService.deleteCollection(collectionId, user);
  }
}
