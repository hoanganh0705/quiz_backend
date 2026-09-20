import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BOOKMARK_THROTTLE } from './throttle.constants';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiAuthCreate } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { BookmarkApplicationService } from '../../application/bookmark.application.service';
import { BookmarkPresenter } from '../presenters/bookmark.presenter';
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
import { BookmarkCursorMapper } from '../../mappers/bookmark-cursor.mapper';
import {
  ApiAddBookmarkResponse,
  ApiBookmarkStatusResponse,
  ApiBulkAddBookmarksResponse,
  ApiBulkRemoveBookmarksResponse,
  ApiBookmarkQuizIdParam,
  ApiCollectionAnalyticsResponse,
  ApiCollectionIdParam,
  ApiCreateCollectionResponse,
  ApiDeleteCollectionResponse,
  ApiListBookmarksInCollectionResponse,
  ApiListCollectionsResponse,
  ApiMoveBookmarkResponse,
  ApiMyBookmarkStatsResponse,
  ApiRecentBookmarksResponse,
  ApiRemoveBookmarkResponse,
  ApiSearchBookmarksResponse,
  ApiStatusQuizIdParam,
  ApiUpdateBookmarkResponse,
  ApiUpdateCollectionResponse,
} from '../swagger/bookmark-swagger-decorators';

@ApiTags('bookmarks')
@Controller('bookmarks')
export class BookmarkController {
  constructor(
    private readonly bookmarkApplicationService: BookmarkApplicationService,
    private readonly presenter: BookmarkPresenter,
  ) {}

  @Get('search')
  @Throttle({ default: BOOKMARK_THROTTLE.searchBookmarks })
  @ApiAuth()
  @ApiSearchBookmarksResponse()
  @ApiOperation({ summary: 'Search bookmarks' })
  async searchBookmarks(@CurrentUser() user: JwtPayload, @Query() query: SearchBookmarksQueryDto) {
    const result = await this.bookmarkApplicationService.searchBookmarks(user.sub, {
      q: query.q,
      limit: query.limit,
      cursor: query.cursor ? BookmarkCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.searchBookmarks(result);
  }

  @Get('recent')
  @Throttle({ default: BOOKMARK_THROTTLE.getRecentBookmarks })
  @ApiAuth()
  @ApiRecentBookmarksResponse()
  @ApiOperation({ summary: 'Get recent bookmarks' })
  async getRecentBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListRecentBookmarksQueryDto,
  ) {
    const result = await this.bookmarkApplicationService.getRecentBookmarks(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? BookmarkCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.getRecentBookmarks(result);
  }

  @Get('quizzes/:quizId/status')
  @Throttle({ default: BOOKMARK_THROTTLE.getBookmarkStatus })
  @ApiAuth()
  @ApiBookmarkStatusResponse()
  @ApiStatusQuizIdParam()
  @ApiOperation({ summary: 'Get bookmark status for a quiz' })
  async getBookmarkStatus(
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.getBookmarkStatus(user, quizId);
    return this.presenter.getBookmarkStatus(result);
  }

  @Get('collections')
  @Throttle({ default: BOOKMARK_THROTTLE.listCollections })
  @ApiAuth()
  @ApiListCollectionsResponse()
  @ApiOperation({ summary: 'List bookmark collections' })
  async listCollections(@CurrentUser() user: JwtPayload) {
    const result = await this.bookmarkApplicationService.listCollections(user);
    return this.presenter.listCollections(result);
  }

  @Post('collections')
  @Throttle({ default: BOOKMARK_THROTTLE.createCollection })
  @ApiAuthCreate({ description: 'Collection created', type: undefined })
  @ApiCreateCollectionResponse()
  @ApiOperation({ summary: 'Create bookmark collection' })
  async createCollection(@CurrentUser() user: JwtPayload, @Body() payload: CreateCollectionDto) {
    const result = await this.bookmarkApplicationService.createCollection(user, payload);
    return this.presenter.createCollection(result);
  }

  // NOTE: GET /bookmarks/collections/{collectionId} returns the BOOKMARKED QUIZZES
  // inside the collection, NOT the collection itself.
  @Get('collections/:collectionId')
  @Throttle({ default: BOOKMARK_THROTTLE.listBookmarksInCollection })
  @ApiAuth()
  @ApiListBookmarksInCollectionResponse()
  @ApiCollectionIdParam()
  @ApiOperation({ summary: 'List bookmarks in a collection' })
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.listBookmarksInCollection(
      collectionId,
      user,
    );
    return this.presenter.listBookmarksInCollection(result);
  }

  @Get('collections/:collectionId/analytics')
  @Throttle({ default: BOOKMARK_THROTTLE.getCollectionAnalytics })
  @ApiAuth()
  @ApiCollectionAnalyticsResponse()
  @ApiCollectionIdParam()
  @ApiOperation({ summary: 'Get collection analytics' })
  async getCollectionAnalytics(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.getCollectionAnalytics(collectionId, user);
    return this.presenter.getCollectionAnalytics(result);
  }

  @Post('collections/:collectionId/quizzes')
  @Throttle({ default: BOOKMARK_THROTTLE.addBookmark })
  @ApiAuth()
  @ApiAddBookmarkResponse()
  @ApiCollectionIdParam()
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ) {
    const result = await this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
    return this.presenter.addBookmark(result);
  }

  // Bulk add is idempotent: duplicates are silently skipped via onConflictDoNothing.
  @Post('collections/:collectionId/quizzes/bulk')
  @Throttle({ default: BOOKMARK_THROTTLE.bulkAddBookmarks })
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiBulkAddBookmarksResponse()
  @ApiCollectionIdParam()
  @ApiOperation({
    summary: 'Bulk add bookmarks',
    description:
      'Adds multiple quizzes to a bookmark collection in a single call. ' +
      'Duplicates and pairs that already exist in the collection are silently skipped ' +
      '(no 409 is produced). The response reports how many rows were actually inserted.',
  })
  async addBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkAddBookmarksDto,
  ) {
    const result = await this.bookmarkApplicationService.addBookmarksBulk(
      user,
      collectionId,
      payload.quizIds,
    );
    return this.presenter.addBookmarksBulk(result);
  }

  // Bulk remove is idempotent: removing a pair that does not exist is a no-op.
  @Delete('collections/:collectionId/quizzes/bulk')
  @Throttle({ default: BOOKMARK_THROTTLE.bulkRemoveBookmarks })
  @ApiAuth()
  @ApiBulkRemoveBookmarksResponse()
  @ApiCollectionIdParam()
  @ApiOperation({
    summary: 'Bulk remove bookmarks',
    description:
      'Removes multiple quizzes from a bookmark collection in a single call. ' +
      'Removing a pair that does not exist is a no-op (no 404 is produced). ' +
      'The response reports how many rows were actually removed.',
  })
  async removeBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkRemoveBookmarksDto,
  ) {
    const result = await this.bookmarkApplicationService.removeBookmarksBulk(
      user,
      collectionId,
      payload.quizIds,
    );
    return this.presenter.removeBookmarksBulk(result);
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  @Throttle({ default: BOOKMARK_THROTTLE.removeBookmark })
  @ApiAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRemoveBookmarkResponse()
  @ApiCollectionIdParam()
  @ApiBookmarkQuizIdParam()
  @ApiOperation({ summary: 'Remove bookmark' })
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }

  @Patch('collections/:collectionId/quizzes/:quizId')
  @Throttle({ default: BOOKMARK_THROTTLE.updateBookmark })
  @ApiAuth()
  @ApiUpdateBookmarkResponse()
  @ApiCollectionIdParam()
  @ApiBookmarkQuizIdParam()
  @ApiOperation({
    summary: 'Update bookmark',
    description: 'Updates the personal notes for a bookmarked quiz in a collection.',
  })
  async updateBookmark(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @Param('quizId', new ParseUUIDPipe({ version: '7' })) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateBookmarkDto,
  ) {
    const result = await this.bookmarkApplicationService.updateBookmark(
      collectionId,
      quizId,
      payload,
      user,
    );
    return this.presenter.updateBookmark(result);
  }

  @Post('collections/:collectionId/move')
  @Throttle({ default: BOOKMARK_THROTTLE.moveBookmark })
  @ApiAuth()
  @ApiMoveBookmarkResponse()
  @ApiCollectionIdParam()
  @ApiOperation({
    summary: 'Move bookmark',
    description:
      'Moves a bookmark from the collection identified by the path parameter ' +
      'into the target collection supplied in the request body.',
  })
  async moveBookmark(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: MoveBookmarkDto,
  ) {
    const result = await this.bookmarkApplicationService.moveBookmark(user, collectionId, payload);
    return this.presenter.moveBookmark(result);
  }

  @Patch('collections/:collectionId')
  @Throttle({ default: BOOKMARK_THROTTLE.updateCollection })
  @ApiAuth()
  @ApiUpdateCollectionResponse()
  @ApiCollectionIdParam()
  @ApiOperation({
    summary: 'Update collection',
    description: 'Updates the name and/or description of an owned bookmark collection.',
  })
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateCollectionDto,
  ) {
    const result = await this.bookmarkApplicationService.updateCollection(
      collectionId,
      payload,
      user,
    );
    return this.presenter.updateCollection(result);
  }

  @Get('me/stats')
  @Throttle({ default: BOOKMARK_THROTTLE.getMyBookmarkStats })
  @ApiAuth()
  @ApiMyBookmarkStatsResponse()
  @ApiOperation({ summary: 'Get my bookmark statistics' })
  async getMyBookmarkStats(@CurrentUser() user: JwtPayload) {
    const result = await this.bookmarkApplicationService.getMyBookmarkStats(user);
    return this.presenter.getMyBookmarkStats(result);
  }

  @Delete('collections/:collectionId')
  @Throttle({ default: BOOKMARK_THROTTLE.deleteCollection })
  @ApiAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteCollectionResponse()
  @ApiCollectionIdParam()
  @ApiOperation({
    summary: 'Delete collection',
    description:
      'Deletes an owned bookmark collection and all bookmarks it contains. ' +
      'A 404 is returned when the collection does not exist or is not owned by the caller.',
  })
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe({ version: '7' })) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.bookmarkApplicationService.deleteCollection(collectionId, user);
  }
}
