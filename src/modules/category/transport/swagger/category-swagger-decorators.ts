import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import {
  ApiCreatedResource,
  ApiOkResource,
  ApiOkResourceArray,
  ApiOkResourceList,
} from '@/common/swagger/api-ok';
import { CategoryAnalyticsResponseDto } from '../../dto/response/category-analytics-response.dto';
import { CategoryResponseDto } from '../../dto/response/category-response.dto';
import { FollowedCategoryItemDto } from '../../dto/response/followed-category-item.dto';
import { MessageResponseDto } from '../../dto/response/message-response.dto';
import { RankedCategoryResponseDto } from '../../dto/response/ranked-category-response.dto';
import { QuizListItemDto } from '@/modules/quiz/dto/response/quiz-list-item.dto';
import {
  analyticsBadRequestExample,
  analyticsInternalErrorExample,
  analyticsNotFoundExample,
  categoryByIdBadRequestExample,
  categoryByIdInternalErrorExample,
  categoryByIdNotFoundExample,
  categoryBySlugInternalErrorExample,
  categoryBySlugNotFoundExample,
  categoryQuizzesInternalErrorExample,
  categoryQuizzesNotFoundExample,
  createCategoryBadRequestExample,
  createCategoryConflictExample,
  createCategoryForbiddenExample,
  createCategoryInternalErrorExample,
  createCategoryUnauthorizedExample,
  deleteCategoryForbiddenExample,
  deleteCategoryInternalErrorExample,
  deleteCategoryNotFoundExample,
  deleteCategoryUnauthorizedExample,
  followedCategoriesBadRequestExample,
  followedCategoriesForbiddenExample,
  followedCategoriesInternalErrorExample,
  followedCategoriesUnauthorizedExample,
  followForbiddenExample,
  followInternalErrorExample,
  followNotFoundExample,
  followTooManyRequestsExample,
  followUnauthorizedExample,
  followBadRequestExample,
  listCategoriesBadRequestExample,
  listCategoriesInternalErrorExample,
  popularBadRequestExample,
  popularInternalErrorExample,
  relatedBadRequestExample,
  relatedInternalErrorExample,
  relatedNotFoundExample,
  restoreConflictExample,
  restoreForbiddenExample,
  restoreInternalErrorExample,
  restoreNotFoundExample,
  restoreUnauthorizedExample,
  trendingBadRequestExample,
  trendingInternalErrorExample,
  unfollowBadRequestExample,
  unfollowForbiddenExample,
  unfollowInternalErrorExample,
  unfollowNotFoundExample,
  unfollowTooManyRequestsExample,
  unfollowUnauthorizedExample,
  updateCategoryBadRequestExample,
  updateCategoryConflictExample,
  updateCategoryForbiddenExample,
  updateCategoryInternalErrorExample,
  updateCategoryNotFoundExample,
  updateCategoryUnauthorizedExample,
  CATEGORY_ANALYTICS_EXAMPLE,
  CATEGORY_DELETE_MESSAGE_EXAMPLE,
  CATEGORY_DETAIL_EXAMPLE,
  CATEGORY_FOLLOWED_LIST_EXAMPLE,
  CATEGORY_FOLLOW_MESSAGE_EXAMPLE,
  CATEGORY_LIST_EXAMPLE,
  CATEGORY_QUIZZES_EXAMPLE,
  CATEGORY_RANKED_LIST_EXAMPLE,
  CATEGORY_RELATED_LIST_EXAMPLE,
  CATEGORY_UNFOLLOW_MESSAGE_EXAMPLE,
} from './examples';

// ─── Shared description strings ────────────────────────────────────────────────
//
// One wording style across every endpoint: third-person imperative.
// Business rules and behavioral notes are documented inline.
const DESCRIPTIONS = {
  // single resource
  categoryById: 'Returns the requested category.',
  categoryBySlug: 'Returns the requested category.',
  categoryCreate: 'Returns the created category.',
  categoryUpdate:
    'Returns the updated category. If no fields are provided, returns the current category state (idempotent behavior).',
  categoryRestore: 'Returns the restored category.',
  // lists
  categoryList: 'Returns the requested categories.',
  categoryRanked:
    'Returns the ranked categories. Note: `totalScore` and `totalAttempts` are returned as strings (SQL SUM aggregation). Timestamps (createdAt, updatedAt) are not included in ranked responses.',
  categoryRelated: 'Returns the related categories.',
  categoryFollowed: 'Returns the categories followed by the authenticated user.',
  categoryAnalytics: 'Returns the category analytics.',
  categoryQuizzes: 'Returns the quizzes in the category.',
  // action confirmations
  categoryFollow:
    'Confirms the category was followed. This operation is idempotent — following a category you already follow succeeds silently.',
  categoryUnfollow: 'Confirms the category was unfollowed.',
  categoryDelete:
    'Confirms the category was deleted. Returns 200 OK with a confirmation message (soft delete — the category can be restored).',
} as const;

// ─── Error response option factory ────────────────────────────────────────────
//
// Each helper builds a ProblemDetail option block whose `example.instance`
// matches the URL of the endpoint that documents it.
const problem = {
  badRequest: (example: object): ApiResponseOptions => ({
    description: 'Request body, query, or params failed validation',
    type: ProblemDetailDto,
    example,
  }),
  unauthorized: (example: object): ApiResponseOptions => ({
    description: 'Authentication is required to access this resource',
    type: ProblemDetailDto,
    example,
  }),
  forbidden: (example: object): ApiResponseOptions => ({
    description: 'Authenticated user lacks the required role or permission',
    type: ProblemDetailDto,
    example,
  }),
  notFound: (example: object): ApiResponseOptions => ({
    description: 'The requested category does not exist or has been deleted',
    type: ProblemDetailDto,
    example,
  }),
  conflict: (example: object): ApiResponseOptions => ({
    description: 'The request conflicts with the current state of the category',
    type: ProblemDetailDto,
    example,
  }),
  tooManyRequests: (example: object): ApiResponseOptions => ({
    description: 'Rate limit exceeded. Please retry after the time indicated in the response',
    type: ProblemDetailDto,
    example,
  }),
  internalError: (example: object): ApiResponseOptions => ({
    description: 'Unexpected server error',
    type: ProblemDetailDto,
    example,
  }),
};

// ─── Per-endpoint composed decorators ─────────────────────────────────────────

/** GET /categories/popular */
export const ApiPopularCategoriesResponse = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceArray(RankedCategoryResponseDto, {
      description: DESCRIPTIONS.categoryRanked,
      example: CATEGORY_RANKED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(popularBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(popularInternalErrorExample)),
  );

/** GET /categories/trending */
export const ApiTrendingCategoriesResponse = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceArray(RankedCategoryResponseDto, {
      description: DESCRIPTIONS.categoryRanked,
      example: CATEGORY_RANKED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(trendingBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(trendingInternalErrorExample)),
  );

/** GET /categories/:slug/quizzes */
export const ApiCategoryQuizzesResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'slug',
      description: 'Category slug (URL-friendly identifier)',
      schema: { type: 'string' },
    }),
    ApiOkResourceList(QuizListItemDto, 'cursor', {
      description: DESCRIPTIONS.categoryQuizzes,
      example: CATEGORY_QUIZZES_EXAMPLE,
    }),
    ApiNotFoundResponse(problem.notFound(categoryQuizzesNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(categoryQuizzesInternalErrorExample)),
  );

/** GET /categories/:slug/related */
export const ApiRelatedCategoriesResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'slug',
      description: 'Category slug (URL-friendly identifier)',
      schema: { type: 'string' },
    }),
    ApiOkResourceArray(CategoryResponseDto, {
      description: DESCRIPTIONS.categoryRelated,
      example: CATEGORY_RELATED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(relatedBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(relatedNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(relatedInternalErrorExample)),
  );

/** GET /categories/:id/analytics */
export const ApiCategoryAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiOkResource(CategoryAnalyticsResponseDto, {
      description: DESCRIPTIONS.categoryAnalytics,
      example: CATEGORY_ANALYTICS_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(analyticsBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(analyticsNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(analyticsInternalErrorExample)),
  );

/** POST /categories/:id/follow */
export const ApiFollowCategoryResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiOkResource(MessageResponseDto, {
      description: DESCRIPTIONS.categoryFollow,
      example: CATEGORY_FOLLOW_MESSAGE_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(followBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(followUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(followForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(followNotFoundExample)),
    ApiTooManyRequestsResponse(problem.tooManyRequests(followTooManyRequestsExample)),
    ApiInternalServerErrorResponse(problem.internalError(followInternalErrorExample)),
  );

/** DELETE /categories/:id/follow */
export const ApiUnfollowCategoryResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiOkResource(MessageResponseDto, {
      description: DESCRIPTIONS.categoryUnfollow,
      example: CATEGORY_UNFOLLOW_MESSAGE_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(unfollowBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(unfollowUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(unfollowForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(unfollowNotFoundExample)),
    ApiTooManyRequestsResponse(problem.tooManyRequests(unfollowTooManyRequestsExample)),
    ApiInternalServerErrorResponse(problem.internalError(unfollowInternalErrorExample)),
  );

/** POST /categories/:id/restore */
export const ApiRestoreCategoryResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiOkResource(CategoryResponseDto, {
      description: DESCRIPTIONS.categoryRestore,
      example: CATEGORY_DETAIL_EXAMPLE,
    }),
    ApiUnauthorizedResponse(problem.unauthorized(restoreUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(restoreForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(restoreNotFoundExample)),
    ApiConflictResponse(problem.conflict(restoreConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(restoreInternalErrorExample)),
  );

/** GET /categories */
export const ApiListCategoriesResponse = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceList(CategoryResponseDto, 'cursor', {
      description: DESCRIPTIONS.categoryList,
      example: CATEGORY_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(listCategoriesBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(listCategoriesInternalErrorExample)),
  );

/** GET /categories/:id */
export const ApiCategoryByIdResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiOkResource(CategoryResponseDto, {
      description: DESCRIPTIONS.categoryById,
      example: CATEGORY_DETAIL_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(categoryByIdBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(categoryByIdNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(categoryByIdInternalErrorExample)),
  );

/** GET /categories/:slug */
export const ApiCategoryBySlugResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'slug',
      description: 'Category slug (URL-friendly identifier)',
      schema: { type: 'string' },
    }),
    ApiOkResource(CategoryResponseDto, {
      description: DESCRIPTIONS.categoryBySlug,
      example: CATEGORY_DETAIL_EXAMPLE,
    }),
    ApiNotFoundResponse(problem.notFound(categoryBySlugNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(categoryBySlugInternalErrorExample)),
  );

/** POST /categories */
export const ApiCreateCategoryResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiCreatedResource(CategoryResponseDto, {
      description: DESCRIPTIONS.categoryCreate,
      example: CATEGORY_DETAIL_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(createCategoryBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(createCategoryUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(createCategoryForbiddenExample)),
    ApiConflictResponse(problem.conflict(createCategoryConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(createCategoryInternalErrorExample)),
  );

/** PATCH /categories/:id */
export const ApiUpdateCategoryResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiOkResource(CategoryResponseDto, {
      description: DESCRIPTIONS.categoryUpdate,
      example: CATEGORY_DETAIL_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(updateCategoryBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(updateCategoryUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(updateCategoryForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(updateCategoryNotFoundExample)),
    ApiConflictResponse(problem.conflict(updateCategoryConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(updateCategoryInternalErrorExample)),
  );

/** DELETE /categories/:id */
export const ApiDeleteCategoryResponse = (): MethodDecorator =>
  applyDecorators(
    ApiParam({
      name: 'id',
      description: 'Category ID (UUID)',
      schema: { type: 'string', format: 'uuid' },
    }),
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiOkResource(MessageResponseDto, {
      description: DESCRIPTIONS.categoryDelete,
      example: CATEGORY_DELETE_MESSAGE_EXAMPLE,
    }),
    ApiUnauthorizedResponse(problem.unauthorized(deleteCategoryUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(deleteCategoryForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(deleteCategoryNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(deleteCategoryInternalErrorExample)),
  );

/** GET /users/me/followed-categories */
export const ApiFollowedCategoriesResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiOkResourceList(FollowedCategoryItemDto, 'cursor', {
      description: DESCRIPTIONS.categoryFollowed,
      example: CATEGORY_FOLLOWED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(followedCategoriesBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(followedCategoriesUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(followedCategoriesForbiddenExample)),
    ApiInternalServerErrorResponse(problem.internalError(followedCategoriesInternalErrorExample)),
  );
