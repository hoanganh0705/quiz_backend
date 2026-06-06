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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
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
} from '../../dto/response';

import { BookmarkDomainExceptionFilter } from '../filters/bookmark-domain-exception.filter';
import { RecentBookmarkCursorMapper } from '../../mappers/recent-bookmark-cursor.mapper';
import { BookmarkSearchCursorMapper } from '../../mappers/bookmark-search-cursor.mapper';

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
@UseFilters(BookmarkDomainExceptionFilter)
export class BookmarkController {
  constructor(private readonly bookmarkApplicationService: BookmarkApplicationService) {}

  @Get('search')
  @ApiAuth()
  @ApiOperation({
    summary: 'Search bookmarks',
    description:
      'Searches bookmarked quizzes across all collections owned by the authenticated user using cursor pagination.',
  })
  @ApiOkResponse({ description: 'Bookmark search results returned', type: SearchBookmarksResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async searchBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchBookmarksQueryDto,
  ): Promise<SearchBookmarksResponseDto> {
    return this.bookmarkApplicationService.searchBookmarks(user.sub, {
      q: query.q,
      limit: query.limit,
      cursor: query.cursor ? BookmarkSearchCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('recent')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get recent bookmarks',
    description:
      'Returns the authenticated user\'s bookmarked quizzes across all collections, cursor-paginated and ordered by most recently bookmarked.',
  })
  @ApiOkResponse({ description: 'Recent bookmarks returned', type: RecentBookmarksResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getRecentBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListRecentBookmarksQueryDto,
  ): Promise<RecentBookmarksResponseDto> {
    return this.bookmarkApplicationService.getRecentBookmarks(user.sub, {
      limit: query.limit,
      cursor: query.cursor ? RecentBookmarkCursorMapper.parse(query.cursor) : null,
    });
  }

  @Get('quizzes/:quizId/status')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get bookmark status for quiz',
    description:
      'Returns whether the authenticated user has bookmarked the quiz and which of their collections contain it.',
  })
  @ApiOkResponse({
    description: 'Bookmark status returned for a bookmarked quiz',
    type: BookmarkStatusResponseDto,
    schema: {
      example: {
        bookmarked: true,
        collections: [
          {
            collectionId: '770e8400-e29b-41d4-a716-446655440000',
            name: 'Favorites',
          },
          {
            collectionId: '770e8400-e29b-41d4-a716-446655440001',
            name: 'React Learning',
          },
        ],
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getBookmarkStatus(
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkStatusResponseDto> {
    return this.bookmarkApplicationService.getBookmarkStatus(user.sub, quizId);
  }

  @Get('collections')
  @ApiAuth()
  @ApiOperation({
    summary: 'List my collections',
    description: 'Returns all bookmark collections owned by the authenticated user.',
  })
  @ApiOkResponse({ description: 'Collections returned', type: BookmarkCollectionListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listCollections(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkCollectionListResponseDto> {
    return this.bookmarkApplicationService.listCollections(user);
  }

  @Post('collections')
  @ApiAuth()
  @ApiOperation({
    summary: 'Create collection',
    description: 'Creates a new bookmark collection for the authenticated user.',
  })
  @ApiCreatedResponse({ description: 'Collection created', type: CreateCollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async createCollection(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateCollectionDto,
  ): Promise<CreateCollectionResponseDto> {
    return this.bookmarkApplicationService.createCollection(user, payload);
  }

  @Get('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'List bookmarks in collection',
    description: 'Returns all bookmarked quizzes within a specific collection.',
  })
  @ApiOkResponse({ description: 'Bookmarks returned', type: BookmarkListResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async listBookmarksInCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkListResponseDto> {
    return this.bookmarkApplicationService.listBookmarksInCollection(collectionId, user);
  }

  @Get('collections/:collectionId/analytics')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get bookmark collection analytics',
    description:
      'Returns analytics for a bookmark collection, including summary metrics and top categories/tags across the bookmarked quizzes.',
  })
  @ApiOkResponse({
    description: 'Bookmark collection analytics returned',
    type: BookmarkCollectionAnalyticsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Bookmark collection analytics not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getCollectionAnalytics(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
  ): Promise<BookmarkCollectionAnalyticsResponseDto> {
    return this.bookmarkApplicationService.getCollectionAnalytics(collectionId);
  }

  @Post('collections/:collectionId/quizzes')
  @ApiAuth()
  @ApiOperation({ summary: 'Add bookmark', description: 'Adds a quiz to a bookmark collection.' })
  @ApiCreatedResponse({ description: 'Bookmark added', type: AddBookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Collection or quiz not found' })
  @ApiConflictResponse({ description: 'Quiz is already bookmarked in this collection' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async addBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: AddBookmarkDto,
  ): Promise<AddBookmarkResponseDto> {
    return this.bookmarkApplicationService.addBookmark(collectionId, payload, user);
  }

  @Post('collections/:collectionId/quizzes/bulk')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bulk add bookmarks',
    description:
      'Adds multiple quizzes to a bookmark collection in a single idempotent request. Duplicate bookmarks are ignored. Maximum 100 quiz IDs per request.',
  })
  @ApiOkResponse({ description: 'Bookmarks added in bulk', type: BulkAddBookmarksResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiBadRequestResponse({ description: 'Validation failed or more than 100 quizIds provided' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async addBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkAddBookmarksDto,
  ): Promise<BulkAddBookmarksResponseDto> {
    return this.bookmarkApplicationService.addBookmarksBulk(user.sub, collectionId, payload.quizIds);
  }

  @Delete('collections/:collectionId/quizzes/bulk')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bulk remove bookmarks',
    description:
      'Removes multiple bookmarks from a collection in a single idempotent request. Missing bookmarks are ignored. Maximum 100 quiz IDs per request.',
  })
  @ApiOkResponse({ description: 'Bookmarks removed in bulk', type: BulkRemoveBookmarksResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiBadRequestResponse({ description: 'Validation failed or more than 100 quizIds provided' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async removeBookmarksBulk(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: BulkRemoveBookmarksDto,
  ): Promise<BulkRemoveBookmarksResponseDto> {
    return this.bookmarkApplicationService.removeBookmarksBulk(user.sub, collectionId, payload.quizIds);
  }

  @Delete('collections/:collectionId/quizzes/:quizId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Remove bookmark',
    description: 'Removes a quiz from a bookmark collection.',
  })
  @ApiOkResponse({ description: 'Bookmark removed', type: RemoveBookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Collection or bookmark not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async removeBookmark(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @Param('quizId', new ParseUUIDPipe()) quizId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RemoveBookmarkResponseDto> {
    return this.bookmarkApplicationService.removeBookmark(collectionId, quizId, user);
  }

  @Post('collections/:collectionId/move')
  @ApiAuth()
  @ApiOperation({
    summary: 'Move bookmark',
    description:
      'Moves an existing bookmarked quiz from one collection to another in a single atomic operation.',
  })
  @ApiOkResponse({ description: 'Bookmark moved', type: MoveBookmarkResponseDto })
  @ApiNotFoundResponse({ description: 'Collection or bookmark not found' })
  @ApiConflictResponse({ description: 'Quiz is already bookmarked in the target collection' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
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
    description: 'Updates the name and/or description of a bookmark collection.',
  })
  @ApiOkResponse({ description: 'Collection updated', type: UpdateCollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiConflictResponse({ description: 'A collection with this name already exists' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async updateCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateCollectionDto,
  ): Promise<UpdateCollectionResponseDto> {
    return this.bookmarkApplicationService.updateCollection(collectionId, payload, user);
  }

  @Get('me/stats')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my bookmark stats',
    description:
      'Returns aggregated statistics for the authenticated user\'s bookmarks, including total collections, total bookmarks, and the most-bookmarked category and tag.',
  })
  @ApiOkResponse({ description: 'Bookmark statistics returned', type: BookmarkStatsResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async getMyBookmarkStats(
    @CurrentUser() user: JwtPayload,
  ): Promise<BookmarkStatsResponseDto> {
    return this.bookmarkApplicationService.getMyBookmarkStats(user);
  }

  @Delete('collections/:collectionId')
  @ApiAuth()
  @ApiOperation({
    summary: 'Delete collection',
    description: 'Deletes a bookmark collection and all its bookmarked quizzes.',
  })
  @ApiOkResponse({ description: 'Collection deleted', type: DeleteCollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found' })
  @ApiForbiddenResponse({ description: 'Not the collection owner' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async deleteCollection(
    @Param('collectionId', new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteCollectionResponseDto> {
    return this.bookmarkApplicationService.deleteCollection(collectionId, user);
  }
}
