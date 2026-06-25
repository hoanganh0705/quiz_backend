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
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthCreate,
  ApiAuthUpdate,
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

@ApiTags('bookmarks')
@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('search')
  @ApiAuthList({ description: 'Bookmark search results returned', type: WrappedSearchBookmarksDto })
  @ApiBadRequestResponse()
  @ApiInternalServerErrorResponse()
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
  @ApiInternalServerErrorResponse()
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
  @ApiInternalServerErrorResponse()
  async getBookmarkStatus(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkStatusResponseDto> {
    return this.bookmarkApplicationService.getBookmarkStatus(user, quizId);
  }

  @Get('collections')
  @ApiAuthList({ description: 'Collections returned', type: WrappedBookmarkCollectionsDto })
  @ApiInternalServerErrorResponse()
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  @ApiAuthCreate({ description: 'Collection created', type: WrappedCreateCollectionDto })
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  @Get('collections/:collectionId')
  @ApiAuthList({ description: 'Bookmarks returned', type: WrappedBookmarkListDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiInternalServerErrorResponse()
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
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to view this collection' })
  @ApiInternalServerErrorResponse()
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
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiConflictResponse({ description: 'Bookmark already exists' })
  @ApiBadRequestResponse()
  @ApiInternalServerErrorResponse()
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  @Post('collections/:collectionId/quizzes/bulk')
  @ApiAuthAction({ description: 'Bookmarks added in bulk', type: WrappedBulkAddDto })
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
  @ApiAuthAction({ description: 'Bookmarks removed in bulk', type: WrappedBulkRemoveDto })
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
  @ApiNotFoundResponse({ description: 'Bookmark or collection not found' })
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }

  @Patch('collections/:collectionId/quizzes/:quizId')
  @ApiAuthUpdate({ description: 'Bookmark updated', type: WrappedUpdateBookmarkDto })
  @ApiNotFoundResponse({ description: 'Bookmark or collection not found' })
  async updateBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateBookmarkDto,
  ): Promise<UpdateBookmarkResponseDto> {
    return this.bookmarkApplicationService.updateBookmark(collectionId, quizId, payload, user);
  }

  @Post('collections/:collectionId/move')
  @ApiAuthAction({ description: 'Bookmark moved', type: WrappedMoveBookmarkDto })
  @ApiNotFoundResponse({ description: 'Bookmark or collection not found' })
  async moveBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: MoveBookmarkDto,
  ): Promise<MoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.moveBookmark(user.sub, collectionId, payload);
  }

  @Patch('collections/:collectionId')
  @ApiAuthUpdate({ description: 'Collection updated', type: WrappedUpdateCollectionDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateCollectionDto,
  ): Promise<UpdateCollectionResponseDto> {
    return this.bookmarkApplicationService.updateCollection(collectionId, payload, user);
  }

  @Get('me/stats')
  @ApiAuthList({ description: 'Bookmark statistics returned', type: WrappedBookmarkStatsDto })
  @ApiInternalServerErrorResponse()
  async getMyBookmarkStats(@CurrentUser() user: JwtPayload): Promise<BookmarkStatsResponseDto> {
    return this.bookmarkApplicationService.getMyBookmarkStats(user);
  }

  @Delete('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({ summary: 'Delete collection' })
  @ApiOkResponse({ description: 'Collection deleted', type: WrappedDeleteCollectionDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    return this.bookmarkApplicationService.deleteCollection(collectionId, user);
  }
}
