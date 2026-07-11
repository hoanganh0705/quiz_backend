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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiAuthCreate } from '@/common/swagger/swagger-decorators';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
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
import {
  BookmarkCollectionListResponseDto,
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
import { BookmarkCursorMapper } from '../../mappers/bookmark-cursor.mapper';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

// Local helpers — every bookmark error response is now emitted by
// GlobalExceptionFilter as RFC 7807 ProblemDetail (the per-module filter
// was deleted in Phase 2). 401/500 still come from GlobalExceptionFilter
// via `ApiAuth` / `ApiAuthCreate`. The helpers below cover 403/404/409
// from bookmark domain errors and reference `ProblemDetailDto` directly.

const bookmarkForbiddenResponse = (
  description = 'You do not have permission to manage this collection',
) =>
  ApiForbiddenResponse({
    description,
    type: ProblemDetailDto,
    example: ErrorResponseExamples.forbidden,
  });

const bookmarkNotFoundResponse = (description = 'Bookmark collection not found') =>
  ApiNotFoundResponse({
    description,
    type: ProblemDetailDto,
    example: ErrorResponseExamples.notFound,
  });

const bookmarkConflictResponse = (description = 'Resource already exists') =>
  ApiConflictResponse({
    description,
    type: ProblemDetailDto,
    example: ErrorResponseExamples.conflict,
  });

@ApiTags('bookmarks')
@Controller('bookmarks')
export class BookmarkController {
  constructor(
    private readonly bookmarkApplicationService: BookmarkApplicationService,
    private readonly presenter: BookmarkPresenter,
  ) {}

  @Get('search')
  @ApiAuth()
  @ApiOperation({ summary: 'Search bookmarks' })
  @ApiOkResourceList(SearchBookmarksResponseDto, 'cursor', {
    description: 'Bookmark search results returned',
  })
  @ApiBadRequestResponse({ description: 'Query parameters failed validation' })
  async searchBookmarks(@CurrentUser() user: JwtPayload, @Query() query: SearchBookmarksQueryDto) {
    const result = await this.bookmarkApplicationService.searchBookmarks(user.sub, {
      q: query.q,
      limit: query.limit,
      cursor: query.cursor ? BookmarkCursorMapper.parse(query.cursor) : null,
    });
    return this.presenter.searchBookmarks(result);
  }

  @Get('recent')
  @ApiAuth()
  @ApiOperation({ summary: 'Get recent bookmarks' })
  @ApiOkResourceList(RecentBookmarksResponseDto, 'cursor', {
    description: 'Recent bookmarks returned',
  })
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
  @ApiAuth()
  @ApiOperation({ summary: 'Get bookmark status for a quiz' })
  @ApiOkResource(BookmarkStatusResponseDto, { description: 'Bookmark status returned' })
  async getBookmarkStatus(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.getBookmarkStatus(user, quizId);
    return this.presenter.getBookmarkStatus(result);
  }

  @Get('collections')
  @ApiAuth()
  @ApiOperation({ summary: 'List bookmark collections' })
  @ApiOkResource(BookmarkCollectionListResponseDto, { description: 'Collections returned' })
  async listCollections(@CurrentUser() user: JwtPayload) {
    const result = await this.bookmarkApplicationService.listCollections(user);
    return this.presenter.listCollections(result);
  }

  @Post('collections')
  @ApiAuthCreate({ description: 'Collection created', type: undefined })
  @bookmarkConflictResponse('A collection with this name already exists')
  async createCollection(@CurrentUser() user: JwtPayload, @Body() payload: CreateCollectionDto) {
    const result = await this.bookmarkApplicationService.createCollection(user, payload);
    return this.presenter.createCollection(result);
  }

  // NOTE: GET /bookmarks/collections/{collectionId} returns the BOOKMARKED QUIZZES
  // inside the collection, NOT the collection itself.
  @Get('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({ summary: 'List bookmarks in a collection' })
  @ApiOkResource(BookmarkListResponseDto, {
    description: 'Bookmarked quizzes inside the collection',
  })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.listBookmarksInCollection(
      collectionId,
      user,
    );
    return this.presenter.listBookmarksInCollection(result);
  }

  @Get('collections/:collectionId/analytics')
  @ApiAuth()
  @ApiOperation({ summary: 'Get collection analytics' })
  @ApiOkResource(BookmarkCollectionAnalyticsResponseDto, {
    description: 'Bookmark collection analytics returned',
  })
  @bookmarkNotFoundResponse('Bookmark collection analytics not found')
  async getCollectionAnalytics(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.getCollectionAnalytics(collectionId, user);
    return this.presenter.getCollectionAnalytics(result);
  }

  @Post('collections/:collectionId/quizzes')
  @ApiAuth()
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  @ApiCreatedResource(AddBookmarkResponseDto, { description: 'Bookmark added' })
  @bookmarkNotFoundResponse('Bookmark collection not found, or quiz not found')
  @bookmarkForbiddenResponse()
  @bookmarkConflictResponse('This quiz is already bookmarked in this collection')
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ) {
    const result = await this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
    return this.presenter.addBookmark(result);
  }

  // Bulk add is idempotent: duplicates are silently skipped via onConflictDoNothing.
  @Post('collections/:collectionId/quizzes/bulk')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bulk add bookmarks',
    description:
      'Adds multiple quizzes to a bookmark collection in a single call. ' +
      'Duplicates and pairs that already exist in the collection are silently skipped ' +
      '(no 409 is produced). The response reports how many rows were actually inserted.',
  })
  @ApiOkResource(BulkAddBookmarksResponseDto, { description: 'Bulk add result' })
  @bookmarkNotFoundResponse(
    'Bookmark collection not found, or collection was deleted while processing this request',
  )
  @bookmarkForbiddenResponse()
  async addBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkAddBookmarksDto,
  ) {
    const result = await this.bookmarkApplicationService.addBookmarksBulk(
      user.sub,
      collectionId,
      payload.quizIds,
    );
    return this.presenter.addBookmarksBulk(result);
  }

  // Bulk remove is idempotent: removing a pair that does not exist is a no-op.
  @Delete('collections/:collectionId/quizzes/bulk')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bulk remove bookmarks',
    description:
      'Removes multiple quizzes from a bookmark collection in a single call. ' +
      'Removing a pair that does not exist is a no-op (no 404 is produced). ' +
      'The response reports how many rows were actually removed.',
  })
  @ApiOkResource(BulkRemoveBookmarksResponseDto, { description: 'Bulk remove result' })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  @bookmarkForbiddenResponse()
  async removeBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkRemoveBookmarksDto,
  ) {
    const result = await this.bookmarkApplicationService.removeBookmarksBulk(
      user.sub,
      collectionId,
      payload.quizIds,
    );
    return this.presenter.removeBookmarksBulk(result);
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  @ApiAuth()
  @ApiOperation({ summary: 'Remove bookmark' })
  @ApiOkResource(RemoveBookmarkResponseDto, { description: 'Bookmark removed' })
  @bookmarkNotFoundResponse('Bookmark not found in this collection')
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
    return this.presenter.removeBookmark(result);
  }

  @Patch('collections/:collectionId/quizzes/:quizId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update bookmark',
    description: 'Updates the personal notes for a bookmarked quiz in a collection.',
  })
  @ApiOkResource(UpdateBookmarkResponseDto, { description: 'Bookmark updated' })
  @bookmarkNotFoundResponse('Bookmark not found in this collection')
  @bookmarkForbiddenResponse()
  async updateBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
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
  @ApiAuth()
  @ApiOperation({
    summary: 'Move bookmark',
    description:
      'Moves a bookmark from the collection identified by the path parameter ' +
      'into the target collection supplied in the request body.',
  })
  @ApiOkResource(MoveBookmarkResponseDto, { description: 'Bookmark moved' })
  @bookmarkNotFoundResponse('Source collection, target collection, or bookmark in source not found')
  @bookmarkForbiddenResponse()
  @bookmarkConflictResponse('The quiz is already bookmarked in the target collection')
  async moveBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: MoveBookmarkDto,
  ) {
    const result = await this.bookmarkApplicationService.moveBookmark(
      user.sub,
      collectionId,
      payload,
    );
    return this.presenter.moveBookmark(result);
  }

  @Patch('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update collection',
    description: 'Updates the name and/or description of an owned bookmark collection.',
  })
  @ApiOkResource(UpdateCollectionResponseDto, { description: 'Collection updated' })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  @bookmarkForbiddenResponse()
  @bookmarkConflictResponse('A collection with this name already exists')
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
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
  @ApiAuth()
  @ApiOperation({ summary: 'Get my bookmark statistics' })
  @ApiOkResource(BookmarkStatsResponseDto, { description: 'Bookmark statistics returned' })
  async getMyBookmarkStats(@CurrentUser() user: JwtPayload) {
    const result = await this.bookmarkApplicationService.getMyBookmarkStats(user);
    return this.presenter.getMyBookmarkStats(result);
  }

  @Delete('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete collection',
    description:
      'Deletes an owned bookmark collection and all bookmarks it contains. ' +
      'A 404 is returned when the collection does not exist or is not owned by the caller.',
  })
  @ApiOkResource(DeleteCollectionResponseDto, { description: 'Collection deleted' })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookmarkApplicationService.deleteCollection(collectionId, user);
    return this.presenter.deleteCollection(result);
  }
}
