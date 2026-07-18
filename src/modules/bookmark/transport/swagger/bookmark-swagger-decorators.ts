import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiUnauthorizedResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';

import {
  AddBookmarkResponseDto,
  BookmarkCollectionAnalyticsResponseDto,
  BookmarkCollectionListResponseDto,
  BookmarkListResponseDto,
  BookmarkStatsResponseDto,
  BookmarkStatusResponseDto,
  BulkAddBookmarksResponseDto,
  BulkRemoveBookmarksResponseDto,
  CreateCollectionResponseDto,
  DeleteCollectionResponseDto,
  MoveBookmarkResponseDto,
  RecentBookmarkItemDto,
  RemoveBookmarkResponseDto,
  SearchBookmarkItemDto,
  UpdateBookmarkResponseDto,
  UpdateCollectionResponseDto,
} from '../../dto/response';

import {
  BOOKMARK_ADDED_EXAMPLE,
  BOOKMARK_BULK_ADDED_EXAMPLE,
  BOOKMARK_BULK_REMOVED_EXAMPLE,
  BOOKMARK_COLLECTION_ANALYTICS_EXAMPLE,
  BOOKMARK_COLLECTION_CREATED_EXAMPLE,
  BOOKMARK_COLLECTION_DELETED_EXAMPLE,
  BOOKMARK_COLLECTION_LIST_EXAMPLE,
  BOOKMARK_COLLECTION_UPDATED_EXAMPLE,
  BOOKMARK_LIST_EXAMPLE,
  BOOKMARK_MOVED_EXAMPLE,
  BOOKMARK_RECENT_EXAMPLE,
  BOOKMARK_REMOVED_EXAMPLE,
  BOOKMARK_SEARCH_EXAMPLE,
  BOOKMARK_STATS_EXAMPLE,
  BOOKMARK_STATUS_EXAMPLE,
  BOOKMARK_STATUS_NOT_BOOKMARKED_EXAMPLE,
  BOOKMARK_UPDATED_EXAMPLE,
} from './examples/bookmark.examples';

import {
  addBookmarkBadRequestExample,
  addBookmarkConflictExample,
  addBookmarkForbiddenExample,
  addBookmarkInternalErrorExample,
  addBookmarkNotFoundExample,
  addBookmarkUnauthorizedExample,
  analyticsBadRequestExample,
  analyticsInternalErrorExample,
  analyticsNotFoundExample,
  analyticsUnauthorizedExample,
  bulkAddBadRequestExample,
  bulkAddForbiddenExample,
  bulkAddInternalErrorExample,
  bulkAddNotFoundExample,
  bulkAddUnauthorizedExample,
  bulkRemoveBadRequestExample,
  bulkRemoveForbiddenExample,
  bulkRemoveInternalErrorExample,
  bulkRemoveNotFoundExample,
  bulkRemoveUnauthorizedExample,
  collectionBookmarksBadRequestExample,
  collectionBookmarksForbiddenExample,
  collectionBookmarksInternalErrorExample,
  collectionBookmarksNotFoundExample,
  collectionBookmarksUnauthorizedExample,
  createCollectionBadRequestExample,
  createCollectionConflictExample,
  createCollectionInternalErrorExample,
  createCollectionUnauthorizedExample,
  deleteCollectionBadRequestExample,
  deleteCollectionForbiddenExample,
  deleteCollectionInternalErrorExample,
  deleteCollectionNotFoundExample,
  deleteCollectionUnauthorizedExample,
  listCollectionsInternalErrorExample,
  listCollectionsUnauthorizedExample,
  moveBookmarkBadRequestExample,
  moveBookmarkConflictExample,
  moveBookmarkForbiddenExample,
  moveBookmarkInternalErrorExample,
  moveBookmarkNotFoundExample,
  moveBookmarkUnauthorizedExample,
  recentBadRequestExample,
  recentInternalErrorExample,
  recentUnauthorizedExample,
  removeBookmarkBadRequestExample,
  removeBookmarkInternalErrorExample,
  removeBookmarkNotFoundExample,
  removeBookmarkUnauthorizedExample,
  searchBadRequestExample,
  searchInternalErrorExample,
  searchUnauthorizedExample,
  statsInternalErrorExample,
  statsUnauthorizedExample,
  statusBadRequestExample,
  statusInternalErrorExample,
  statusUnauthorizedExample,
  updateBookmarkBadRequestExample,
  updateBookmarkForbiddenExample,
  updateBookmarkInternalErrorExample,
  updateBookmarkNotFoundExample,
  updateBookmarkUnauthorizedExample,
  updateCollectionBadRequestExample,
  updateCollectionConflictExample,
  updateCollectionForbiddenExample,
  updateCollectionInternalErrorExample,
  updateCollectionNotFoundExample,
  updateCollectionUnauthorizedExample,
} from './examples/errors.examples';

// ─── Error response option factory ──────────────────────────────────────────
//
// Each helper builds a ProblemDetail option block whose `example.instance`
// matches the URL of the endpoint that documents it, so the spec reflects
// the actual request path rather than a generic placeholder.

const problem = {
  badRequest: (example: object): ApiResponseOptions => ({
    description: 'Request body, query, or path parameters failed validation',
    type: ProblemDetailDto,
    example,
  }),
  unauthorized: (example: object): ApiResponseOptions => ({
    description: 'Authentication is required to access this resource',
    type: ProblemDetailDto,
    example,
  }),
  forbidden: (example: object): ApiResponseOptions => ({
    description:
      'Authenticated user does not own this bookmark collection or is not allowed to perform this action',
    type: ProblemDetailDto,
    example,
  }),
  notFound: (example: object): ApiResponseOptions => ({
    description: 'Bookmark collection, bookmark, or quiz does not exist (or is hidden)',
    type: ProblemDetailDto,
    example,
  }),
  conflict: (example: object): ApiResponseOptions => ({
    description: 'The request conflicts with the current state of the bookmark module',
    type: ProblemDetailDto,
    example,
  }),
  internalError: (example: object): ApiResponseOptions => ({
    description: 'Unexpected server error',
    type: ProblemDetailDto,
    example,
  }),
};

// ─── Per-endpoint composed decorators ──────────────────────────────────────

const resourceOk = <T extends Type>(model: T, description: string, example?: unknown) =>
  ApiOkResource(model, { description, example });

const resourceCreated = <T extends Type>(model: T, description: string, example?: unknown) =>
  ApiCreatedResource(model, { description, example });

const resourceList = <T extends Type>(
  model: T,
  kind: 'cursor' | 'offset',
  description: string,
  example?: unknown,
) => ApiOkResourceList(model, kind, { description, example });

// ─── GET /bookmarks/search ──────────────────────────────────────────────────

export const ApiSearchBookmarksResponse = (): MethodDecorator =>
  applyDecorators(
    resourceList<typeof SearchBookmarkItemDto>(
      SearchBookmarkItemDto,
      'cursor',
      'Bookmark search results returned.',
      BOOKMARK_SEARCH_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(searchBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(searchUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(searchInternalErrorExample)),
  );

// ─── GET /bookmarks/recent ───────────────────────────────────────────────────

export const ApiRecentBookmarksResponse = (): MethodDecorator =>
  applyDecorators(
    resourceList<typeof RecentBookmarkItemDto>(
      RecentBookmarkItemDto,
      'cursor',
      'Recent bookmarks returned.',
      BOOKMARK_RECENT_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(recentBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(recentUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(recentInternalErrorExample)),
  );

// ─── GET /bookmarks/quizzes/:quizId/status ──────────────────────────────────

export const ApiBookmarkStatusResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof BookmarkStatusResponseDto>(
      BookmarkStatusResponseDto,
      'Bookmark status returned. When the quiz is not bookmarked (or does not exist) the response is `{ bookmarked: false, collections: [] }` with HTTP 200; see BOOKMARK_STATUS_NOT_BOOKMARKED_EXAMPLE.',
      BOOKMARK_STATUS_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(statusBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(statusUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(statusInternalErrorExample)),
  );

export const BOOKMARK_STATUS_NOT_BOOKMARKED_OK_EXAMPLE = BOOKMARK_STATUS_NOT_BOOKMARKED_EXAMPLE;

// ─── GET /bookmarks/collections ─────────────────────────────────────────────

export const ApiListCollectionsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof BookmarkCollectionListResponseDto>(
      BookmarkCollectionListResponseDto,
      'Collections owned by the authenticated user.',
      BOOKMARK_COLLECTION_LIST_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(listCollectionsUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(listCollectionsInternalErrorExample)),
  );

// ─── POST /bookmarks/collections ────────────────────────────────────────────

export const ApiCreateCollectionResponse = (): MethodDecorator =>
  applyDecorators(
    resourceCreated<typeof CreateCollectionResponseDto>(
      CreateCollectionResponseDto,
      'Collection created.',
      BOOKMARK_COLLECTION_CREATED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(createCollectionBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(createCollectionUnauthorizedExample)),
    ApiConflictResponse(problem.conflict(createCollectionConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(createCollectionInternalErrorExample)),
  );

// ─── GET /bookmarks/collections/:collectionId (bookmarks inside) ─────────────

export const ApiListBookmarksInCollectionResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof BookmarkListResponseDto>(
      BookmarkListResponseDto,
      'Bookmarked quizzes inside the collection.',
      BOOKMARK_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(collectionBookmarksBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(collectionBookmarksUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(collectionBookmarksForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(collectionBookmarksNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(collectionBookmarksInternalErrorExample)),
  );

// ─── GET /bookmarks/collections/:collectionId/analytics ─────────────────────

export const ApiCollectionAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof BookmarkCollectionAnalyticsResponseDto>(
      BookmarkCollectionAnalyticsResponseDto,
      'Bookmark collection analytics returned.',
      BOOKMARK_COLLECTION_ANALYTICS_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(analyticsBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(analyticsUnauthorizedExample)),
    ApiNotFoundResponse(problem.notFound(analyticsNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(analyticsInternalErrorExample)),
  );

// ─── POST /bookmarks/collections/:collectionId/quizzes ──────────────────────

export const ApiAddBookmarkResponse = (): MethodDecorator =>
  applyDecorators(
    resourceCreated<typeof AddBookmarkResponseDto>(
      AddBookmarkResponseDto,
      'Bookmark added.',
      BOOKMARK_ADDED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(addBookmarkBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(addBookmarkUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(addBookmarkForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(addBookmarkNotFoundExample)),
    ApiConflictResponse(problem.conflict(addBookmarkConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(addBookmarkInternalErrorExample)),
  );

// ─── POST /bookmarks/collections/:collectionId/quizzes/bulk ─────────────────

export const ApiBulkAddBookmarksResponse = (): MethodDecorator =>
  applyDecorators(
    resourceCreated<typeof BulkAddBookmarksResponseDto>(
      BulkAddBookmarksResponseDto,
      'Bulk add result. Duplicates are silently skipped.',
      BOOKMARK_BULK_ADDED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(bulkAddBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(bulkAddUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(bulkAddForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(bulkAddNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(bulkAddInternalErrorExample)),
  );

// ─── DELETE /bookmarks/collections/:collectionId/quizzes/bulk ──────────────

export const ApiBulkRemoveBookmarksResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof BulkRemoveBookmarksResponseDto>(
      BulkRemoveBookmarksResponseDto,
      'Bulk remove result. Non-existent pairs are silently skipped.',
      BOOKMARK_BULK_REMOVED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(bulkRemoveBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(bulkRemoveUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(bulkRemoveForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(bulkRemoveNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(bulkRemoveInternalErrorExample)),
  );

// ─── DELETE /bookmarks/collections/:collectionId/quizzes/:quizId ───────────

export const ApiRemoveBookmarkResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof RemoveBookmarkResponseDto>(
      RemoveBookmarkResponseDto,
      'Bookmark removed.',
      BOOKMARK_REMOVED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(removeBookmarkBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(removeBookmarkUnauthorizedExample)),
    ApiNotFoundResponse(problem.notFound(removeBookmarkNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(removeBookmarkInternalErrorExample)),
  );

// ─── PATCH /bookmarks/collections/:collectionId/quizzes/:quizId ────────────

export const ApiUpdateBookmarkResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof UpdateBookmarkResponseDto>(
      UpdateBookmarkResponseDto,
      'Bookmark updated.',
      BOOKMARK_UPDATED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(updateBookmarkBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(updateBookmarkUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(updateBookmarkForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(updateBookmarkNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(updateBookmarkInternalErrorExample)),
  );

// ─── POST /bookmarks/collections/:collectionId/move ─────────────────────────

export const ApiMoveBookmarkResponse = (): MethodDecorator =>
  applyDecorators(
    resourceCreated<typeof MoveBookmarkResponseDto>(
      MoveBookmarkResponseDto,
      'Bookmark moved.',
      BOOKMARK_MOVED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(moveBookmarkBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(moveBookmarkUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(moveBookmarkForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(moveBookmarkNotFoundExample)),
    ApiConflictResponse(problem.conflict(moveBookmarkConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(moveBookmarkInternalErrorExample)),
  );

// ─── PATCH /bookmarks/collections/:collectionId ─────────────────────────────

export const ApiUpdateCollectionResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof UpdateCollectionResponseDto>(
      UpdateCollectionResponseDto,
      'Collection updated.',
      BOOKMARK_COLLECTION_UPDATED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(updateCollectionBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(updateCollectionUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(updateCollectionForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(updateCollectionNotFoundExample)),
    ApiConflictResponse(problem.conflict(updateCollectionConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(updateCollectionInternalErrorExample)),
  );

// ─── GET /bookmarks/me/stats ────────────────────────────────────────────────

export const ApiMyBookmarkStatsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof BookmarkStatsResponseDto>(
      BookmarkStatsResponseDto,
      'Bookmark statistics returned.',
      BOOKMARK_STATS_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(statsUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(statsInternalErrorExample)),
  );

// ─── DELETE /bookmarks/collections/:collectionId ─────────────────────────────

export const ApiDeleteCollectionResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof DeleteCollectionResponseDto>(
      DeleteCollectionResponseDto,
      'Collection deleted (hard delete — not recoverable via the API).',
      BOOKMARK_COLLECTION_DELETED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(deleteCollectionBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(deleteCollectionUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(deleteCollectionForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(deleteCollectionNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(deleteCollectionInternalErrorExample)),
  );

// ─── Path parameter decorators ──────────────────────────────────────────────

export const ApiCollectionIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'collectionId',
    description: 'UUID of the bookmark collection',
    format: 'uuid',
    example: '770e8400-e29b-71d4-a716-446655440000',
  });

export const ApiBookmarkQuizIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'quizId',
    description: 'UUID of the bookmarked quiz',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  });

export const ApiStatusQuizIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'quizId',
    description: 'UUID of the quiz to look up bookmark status for',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  });

// ─── Bookmark module's complete DTO surface (re-export for the contract test) ─

export const BOOKMARK_DTOS_FOR_CONTRACT_TEST: ReadonlyArray<string> = [
  'BookmarkCollectionResponseDto',
  'BookmarkCollectionListResponseDto',
  'CreateCollectionResponseDto',
  'UpdateCollectionResponseDto',
  'DeleteCollectionResponseDto',
  'BookmarkCollectionAnalyticsResponseDto',
  'BookmarkCollectionAnalyticsSummaryDto',
  'BookmarkCollectionAnalyticsTopCategoryDto',
  'BookmarkCollectionAnalyticsTopTagDto',
  'BookmarkStatusResponseDto',
  'BookmarkStatusCollectionDto',
  'BookmarkListResponseDto',
  'BookmarkedQuizResponseDto',
  'AddBookmarkResponseDto',
  'UpdateBookmarkResponseDto',
  'RemoveBookmarkResponseDto',
  'MoveBookmarkResponseDto',
  'BookmarkStatsResponseDto',
  'BookmarkStatsFavoriteCategoryDto',
  'BookmarkStatsFavoriteTagDto',
  'BulkAddBookmarksResponseDto',
  'BulkRemoveBookmarksResponseDto',
  'RecentBookmarksResponseDto',
  'RecentBookmarkItemDto',
  'RecentBookmarksPaginationDto',
  'SearchBookmarksResponseDto',
  'SearchBookmarkItemDto',
  'CreateCollectionDto',
  'UpdateCollectionDto',
  'AddBookmarkDto',
  'BulkAddBookmarksDto',
  'BulkRemoveBookmarksDto',
  'UpdateBookmarkDto',
  'MoveBookmarkDto',
  'SearchBookmarksQueryDto',
  'ListRecentBookmarksQueryDto',
];
