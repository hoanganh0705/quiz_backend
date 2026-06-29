import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { WrappedQuizListDto } from '@/modules/quiz/dto/response/quiz-response-docs.dto';
import {
  TagWrappedAnalyticsDto,
  TagWrappedDeleteMessageDto,
  TagWrappedFollowMessageDto,
  TagWrappedFollowedListDto,
  TagWrappedListDto,
  TagWrappedRankedListDto,
  TagWrappedRelatedListDto,
  TagWrappedTagDto,
} from '../../dto/response/tag-response-docs.dto';
import {
  analyticsBadRequestExample,
  analyticsInternalErrorExample,
  analyticsNotFoundExample,
  createTagBadRequestExample,
  createTagConflictExample,
  createTagForbiddenExample,
  createTagInternalErrorExample,
  createTagUnauthorizedExample,
  deleteTagForbiddenExample,
  deleteTagInternalErrorExample,
  deleteTagNotFoundExample,
  deleteTagUnauthorizedExample,
  followedTagsBadRequestExample,
  followedTagsForbiddenExample,
  followedTagsInternalErrorExample,
  followedTagsUnauthorizedExample,
  followForbiddenExample,
  followInternalErrorExample,
  followNotFoundExample,
  followTooManyRequestsExample,
  followUnauthorizedExample,
  followBadRequestExample,
  listTagsBadRequestExample,
  listTagsInternalErrorExample,
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
  tagBySlugInternalErrorExample,
  tagBySlugNotFoundExample,
  tagQuizzesInternalErrorExample,
  tagQuizzesNotFoundExample,
  trendingBadRequestExample,
  trendingInternalErrorExample,
  unfollowForbiddenExample,
  unfollowInternalErrorExample,
  unfollowNotFoundExample,
  unfollowTooManyRequestsExample,
  unfollowUnauthorizedExample,
  unfollowBadRequestExample,
  updateTagBadRequestExample,
  updateTagConflictExample,
  updateTagForbiddenExample,
  updateTagInternalErrorExample,
  updateTagNotFoundExample,
  updateTagUnauthorizedExample,
  TAG_ANALYTICS_EXAMPLE,
  TAG_DELETE_MESSAGE_EXAMPLE,
  TAG_DETAIL_EXAMPLE,
  TAG_FOLLOW_MESSAGE_EXAMPLE,
  TAG_FOLLOWED_LIST_EXAMPLE,
  TAG_LIST_EXAMPLE,
  TAG_QUIZZES_EXAMPLE,
  TAG_RANKED_LIST_EXAMPLE,
  TAG_RELATED_LIST_EXAMPLE,
  TAG_UNFOLLOW_MESSAGE_EXAMPLE,
} from './examples';

// ─── 200/201 success response factory ──────────────────────────────────────────
//
// Single helper so every success decorator below stays a one-liner.
const createDataResponse = (
  status: 200 | 201,
  description: string,
  type: Type<unknown>,
  example: object,
): MethodDecorator =>
  status === 201
    ? ApiCreatedResponse({ description, type, example })
    : ApiOkResponse({ description, type, example });

// ─── Shared description strings ─────────────────────────────────────────────────
//
// One wording style across every endpoint: imperative third-person verb.

const DESCRIPTIONS = {
  // 200 — single tag
  tagBySlug: 'Returns the requested tag.',
  tagCreate: 'Returns the created tag.',
  tagUpdate: 'Returns the updated tag.',
  tagRestore: 'Returns the restored tag.',
  // 200 — tag lists
  tagList: 'Returns the requested tags.',
  tagRanked: 'Returns the ranked tags.',
  tagRelated: 'Returns the related tags.',
  tagFollowed: 'Returns the followed tags.',
  tagAnalytics: 'Returns the tag analytics.',
  tagQuizzes: 'Returns the quizzes in the tag.',
  // 200 — action confirmations
  tagFollow: 'Confirms the tag was followed.',
  tagUnfollow: 'Confirms the tag was unfollowed.',
  tagDelete: 'Confirms the tag was deleted.',
} as const;

// ─── Error response option factory ──────────────────────────────────────────────
//
// Each helper builds a ProblemDetail option block whose `example.instance`
// matches the URL of the endpoint that documents it, so the spec reflects
// the actual request path rather than a generic placeholder.

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
    description: 'The requested tag does not exist or has been deleted',
    type: ProblemDetailDto,
    example,
  }),
  conflict: (example: object): ApiResponseOptions => ({
    description: 'The request conflicts with the current state of the tag',
    type: ProblemDetailDto,
    example,
  }),
  tooManyRequests: (example: object): ApiResponseOptions => ({
    description: 'Rate limit exceeded for this endpoint',
    type: ProblemDetailDto,
    example,
  }),
  internalError: (example: object): ApiResponseOptions => ({
    description: 'Unexpected server error',
    type: ProblemDetailDto,
    example,
  }),
};

// ─── Per-endpoint composed decorators ──────────────────────────────────────────
//
// Each function below documents one Tag endpoint's full response surface:
// exactly the status codes the runtime can produce, with examples that point
// at the correct request path. Decorators for authenticated endpoints also
// declare the JWT bearer security scheme so Swagger UI prompts for a token.

export const ApiPopularTagsResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(
      200,
      DESCRIPTIONS.tagRanked,
      TagWrappedRankedListDto,
      TAG_RANKED_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(popularBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(popularInternalErrorExample)),
  );

export const ApiTrendingTagsResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(
      200,
      DESCRIPTIONS.tagRanked,
      TagWrappedRankedListDto,
      TAG_RANKED_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(trendingBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(trendingInternalErrorExample)),
  );

export const ApiTagQuizzesResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(200, DESCRIPTIONS.tagQuizzes, WrappedQuizListDto, TAG_QUIZZES_EXAMPLE),
    ApiNotFoundResponse(problem.notFound(tagQuizzesNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(tagQuizzesInternalErrorExample)),
  );

export const ApiRelatedTagsResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(
      200,
      DESCRIPTIONS.tagRelated,
      TagWrappedRelatedListDto,
      TAG_RELATED_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(relatedBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(relatedNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(relatedInternalErrorExample)),
  );

export const ApiTagAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(
      200,
      DESCRIPTIONS.tagAnalytics,
      TagWrappedAnalyticsDto,
      TAG_ANALYTICS_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(analyticsBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(analyticsNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(analyticsInternalErrorExample)),
  );

export const ApiFollowTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(
      200,
      DESCRIPTIONS.tagFollow,
      TagWrappedFollowMessageDto,
      TAG_FOLLOW_MESSAGE_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(followBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(followUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(followForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(followNotFoundExample)),
    ApiTooManyRequestsResponse(problem.tooManyRequests(followTooManyRequestsExample)),
    ApiInternalServerErrorResponse(problem.internalError(followInternalErrorExample)),
  );

export const ApiUnfollowTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(
      200,
      DESCRIPTIONS.tagUnfollow,
      TagWrappedFollowMessageDto,
      TAG_UNFOLLOW_MESSAGE_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(unfollowBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(unfollowUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(unfollowForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(unfollowNotFoundExample)),
    ApiTooManyRequestsResponse(problem.tooManyRequests(unfollowTooManyRequestsExample)),
    ApiInternalServerErrorResponse(problem.internalError(unfollowInternalErrorExample)),
  );

export const ApiRestoreTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(200, DESCRIPTIONS.tagRestore, TagWrappedTagDto, TAG_DETAIL_EXAMPLE),
    ApiUnauthorizedResponse(problem.unauthorized(restoreUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(restoreForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(restoreNotFoundExample)),
    ApiConflictResponse(problem.conflict(restoreConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(restoreInternalErrorExample)),
  );

export const ApiListTagsResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(200, DESCRIPTIONS.tagList, TagWrappedListDto, TAG_LIST_EXAMPLE),
    ApiBadRequestResponse(problem.badRequest(listTagsBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(listTagsInternalErrorExample)),
  );

export const ApiTagBySlugResponse = (): MethodDecorator =>
  applyDecorators(
    createDataResponse(200, DESCRIPTIONS.tagBySlug, TagWrappedTagDto, TAG_DETAIL_EXAMPLE),
    ApiNotFoundResponse(problem.notFound(tagBySlugNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(tagBySlugInternalErrorExample)),
  );

export const ApiCreateTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(201, DESCRIPTIONS.tagCreate, TagWrappedTagDto, TAG_DETAIL_EXAMPLE),
    ApiBadRequestResponse(problem.badRequest(createTagBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(createTagUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(createTagForbiddenExample)),
    ApiConflictResponse(problem.conflict(createTagConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(createTagInternalErrorExample)),
  );

export const ApiUpdateTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(200, DESCRIPTIONS.tagUpdate, TagWrappedTagDto, TAG_DETAIL_EXAMPLE),
    ApiBadRequestResponse(problem.badRequest(updateTagBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(updateTagUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(updateTagForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(updateTagNotFoundExample)),
    ApiConflictResponse(problem.conflict(updateTagConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(updateTagInternalErrorExample)),
  );

export const ApiDeleteTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(
      200,
      DESCRIPTIONS.tagDelete,
      TagWrappedDeleteMessageDto,
      TAG_DELETE_MESSAGE_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(deleteTagUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(deleteTagForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(deleteTagNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(deleteTagInternalErrorExample)),
  );

export const ApiFollowedTagsResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    createDataResponse(
      200,
      DESCRIPTIONS.tagFollowed,
      TagWrappedFollowedListDto,
      TAG_FOLLOWED_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(followedTagsBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(followedTagsUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(followedTagsForbiddenExample)),
    ApiInternalServerErrorResponse(problem.internalError(followedTagsInternalErrorExample)),
  );
