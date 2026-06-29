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
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthCreate,
  ApiAuthAction,
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
import {
  BookmarkDomainErrorDto,
  WrappedBookmarkStatusDto,
  WrappedBookmarkCollectionsDto,
  WrappedBookmarkListDto,
  WrappedSearchBookmarksDto,
  WrappedRecentBookmarksDto,
  WrappedCreateCollectionDto,
  WrappedAddBookmarkDto,
  WrappedBulkAddDto,
  WrappedBulkRemoveDto,
  WrappedRemoveBookmarkDto,
  WrappedUpdateBookmarkDto,
  WrappedMoveBookmarkDto,
  WrappedUpdateCollectionDto,
  WrappedBookmarkStatsDto,
  WrappedDeleteCollectionDto,
  WrappedCollectionAnalyticsDto,
} from '../../dto/response/bookmark-response-docs.dto';

// Local helpers — these decorators emit the response schemas that match the
// actual runtime error shapes produced by BookmarkDomainExceptionFilter:
//
//   { statusCode: number, message: string, error: string }
//
// Use these for any 403 / 404 / 409 produced by a bookmark domain error.
// (401, 400, 500 are emitted by GlobalExceptionFilter as RFC 7807 ProblemDetail
// and are handled by the generic ApiAuth / ApiAuthList / ApiAuthCreate /
// ApiAuthAction decorators.)

const bookmarkForbiddenResponse = (
  description = 'You do not have permission to manage this collection',
) =>
  ApiForbiddenResponse({
    description,
    type: BookmarkDomainErrorDto,
  });

const bookmarkNotFoundResponse = (description = 'Bookmark collection not found') =>
  ApiNotFoundResponse({ description, type: BookmarkDomainErrorDto });

const bookmarkConflictResponse = (description = 'Resource already exists') =>
  ApiConflictResponse({ description, type: BookmarkDomainErrorDto });

@ApiTags('bookmarks')
@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('search')
  @ApiAuthList({ description: 'Bookmark search results returned', type: WrappedSearchBookmarksDto })
  @ApiBadRequestResponse({ description: 'Query parameters failed validation' })
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
  @ApiAuthList({ description: 'Recent bookmarks returned', type: WrappedRecentBookmarksDto })
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
  @ApiAuthList({ description: 'Bookmark status returned', type: WrappedBookmarkStatusDto })
  async getBookmarkStatus(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkStatusResponseDto> {
    return this.bookmarkApplicationService.getBookmarkStatus(user, quizId);
  }

  @Get('collections')
  @ApiAuthList({ description: 'Collections returned', type: WrappedBookmarkCollectionsDto })
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  @ApiAuthCreate({ description: 'Collection created', type: WrappedCreateCollectionDto })
  @bookmarkConflictResponse('A collection with this name already exists')
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  // NOTE: GET /bookmarks/collections/{collectionId} returns the BOOKMARKED QUIZZES
  // inside the collection, NOT the collection itself. There is no endpoint that
  // returns a single bookmark collection by id.
  @Get('collections/:collectionId')
  @ApiAuthList({
    description: 'Bookmarked quizzes inside the collection',
    type: WrappedBookmarkListDto,
  })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    return this.bookmarkApplicationService.listBookmarksInCollection(collectionId, user);
  }

  @Get('collections/:collectionId/analytics')
  @ApiAuthList({
    description: 'Bookmark collection analytics returned',
    type: WrappedCollectionAnalyticsDto,
  })
  @bookmarkNotFoundResponse('Bookmark collection analytics not found')
  async getCollectionAnalytics(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionAnalyticsResponseDto> {
    return this.bookmarkApplicationService.getCollectionAnalytics(collectionId, user);
  }

  @Post('collections/:collectionId/quizzes')
  @ApiAuth()
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  @ApiCreatedResponse({ description: 'Bookmark added', type: WrappedAddBookmarkDto })
  @bookmarkNotFoundResponse('Bookmark collection not found, or quiz not found')
  @bookmarkForbiddenResponse()
  @bookmarkConflictResponse('This quiz is already bookmarked in this collection')
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  // Bulk add is idempotent: duplicates are silently skipped via onConflictDoNothing.
  // The implementation never throws a 409 Conflict — use the singular /quizzes
  // endpoint if a conflict response is required.
  @Post('collections/:collectionId/quizzes/bulk')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bulk add bookmarks',
    description:
      'Adds multiple quizzes to a bookmark collection in a single call. ' +
      'Duplicates and pairs that already exist in the collection are silently skipped ' +
      '(no 409 is produced). The response reports how many rows were actually inserted.',
  })
  @ApiOkResponse({ description: 'Bulk add result', type: WrappedBulkAddDto })
  @bookmarkNotFoundResponse(
    'Bookmark collection not found, or collection was deleted while processing this request',
  )
  @bookmarkForbiddenResponse()
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

  // Bulk remove is idempotent: removing a pair that does not exist is a no-op.
  // The implementation never throws a 409 Conflict.
  @Delete('collections/:collectionId/quizzes/bulk')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bulk remove bookmarks',
    description:
      'Removes multiple quizzes from a bookmark collection in a single call. ' +
      'Removing a pair that does not exist is a no-op (no 404 is produced). ' +
      'The response reports how many rows were actually removed.',
  })
  @ApiOkResponse({ description: 'Bulk remove result', type: WrappedBulkRemoveDto })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  @bookmarkForbiddenResponse()
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
  @ApiAuthAction({ description: 'Bookmark removed', type: WrappedRemoveBookmarkDto })
  @bookmarkNotFoundResponse('Bookmark not found in this collection')
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }

  @Patch('collections/:collectionId/quizzes/:quizId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update bookmark',
    description: 'Updates the personal notes for a bookmarked quiz in a collection.',
  })
  @ApiOkResponse({ description: 'Bookmark updated', type: WrappedUpdateBookmarkDto })
  @bookmarkNotFoundResponse('Bookmark not found in this collection')
  @bookmarkForbiddenResponse()
  async updateBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateBookmarkDto,
  ): Promise<UpdateBookmarkResponseDto> {
    return this.bookmarkApplicationService.updateBookmark(collectionId, quizId, payload, user);
  }

  @Post('collections/:collectionId/move')
  @ApiAuth()
  @ApiOperation({
    summary: 'Move bookmark',
    description:
      'Moves a bookmark from the collection identified by the path parameter ' +
      'into the target collection supplied in the request body.',
  })
  @ApiOkResponse({ description: 'Bookmark moved', type: WrappedMoveBookmarkDto })
  @bookmarkNotFoundResponse('Source collection, target collection, or bookmark in source not found')
  @bookmarkForbiddenResponse()
  @bookmarkConflictResponse('The quiz is already bookmarked in the target collection')
  async moveBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: MoveBookmarkDto,
  ): Promise<MoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.moveBookmark(user.sub, collectionId, payload);
  }

  @Patch('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Update collection',
    description: 'Updates the name and/or description of an owned bookmark collection.',
  })
  @ApiOkResponse({ description: 'Collection updated', type: WrappedUpdateCollectionDto })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  @bookmarkForbiddenResponse()
  @bookmarkConflictResponse('A collection with this name already exists')
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateCollectionDto,
  ): Promise<UpdateCollectionResponseDto> {
    return this.bookmarkApplicationService.updateCollection(collectionId, payload, user);
  }

  @Get('me/stats')
  @ApiAuthList({ description: 'Bookmark statistics returned', type: WrappedBookmarkStatsDto })
  async getMyBookmarkStats(@CurrentUser() user: JwtPayload): Promise<BookmarkStatsResponseDto> {
    return this.bookmarkApplicationService.getMyBookmarkStats(user);
  }

  @Delete('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete collection',
    description:
      'Deletes an owned bookmark collection and all bookmarks it contains. ' +
      'A 404 is returned when the collection does not exist or is not owned by the caller.',
  })
  @ApiOkResponse({ description: 'Collection deleted', type: WrappedDeleteCollectionDto })
  @bookmarkNotFoundResponse('Bookmark collection not found')
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    return this.bookmarkApplicationService.deleteCollection(collectionId, user);
  }
}
