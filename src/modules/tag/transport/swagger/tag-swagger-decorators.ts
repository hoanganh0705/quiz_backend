import { applyDecorators, type Type } from '@nestjs/common';
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
import { FollowedTagItemDto } from '../../dto/response/parity-response.dto';
import { DeleteTagResponseDto } from '../../dto/response/delete-tag-response.dto';
import {
  RankedTagResponseDto,
  TagAnalyticsResponseDto,
  TagFollowMessageResponseDto,
} from '../../dto/response/parity-response.dto';
import { TagResponseDto } from '../../dto/response/tag-response.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { TAG_QUIZZES_EXAMPLE } from './examples/tag.examples';
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
} from './examples';
import { TAG_RANKED_LIST_EXAMPLE, TAG_RELATED_LIST_EXAMPLE } from './examples/discovery.examples';
import {
  TAG_ANALYTICS_EXAMPLE,
  TAG_CREATED_EXAMPLE,
  TAG_DELETE_MESSAGE_EXAMPLE,
  TAG_DETAIL_EXAMPLE,
  TAG_FOLLOWED_LIST_EXAMPLE,
  TAG_FOLLOW_MESSAGE_EXAMPLE,
  TAG_LIST_EXAMPLE,
  TAG_RESTORED_EXAMPLE,
  TAG_UNFOLLOW_MESSAGE_EXAMPLE,
  TAG_UPDATED_EXAMPLE,
} from './examples';

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

export const ApiPopularTagsResponse = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceArray(RankedTagResponseDto, {
      description: 'Returns the ranked tags.',
      example: TAG_RANKED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(popularBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(popularInternalErrorExample)),
  );

export const ApiTrendingTagsResponse = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceArray(RankedTagResponseDto, {
      description: 'Returns the ranked tags.',
      example: TAG_RANKED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(trendingBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(trendingInternalErrorExample)),
  );

export const ApiTagQuizzesResponse = (): MethodDecorator =>
  applyDecorators(
    resourceList<typeof QuizListResponseDto>(
      QuizListResponseDto as unknown as Type,
      'cursor',
      'Returns the quizzes in the tag.',
      TAG_QUIZZES_EXAMPLE,
    ),
    ApiNotFoundResponse(problem.notFound(tagQuizzesNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(tagQuizzesInternalErrorExample)),
  );

export const ApiRelatedTagsResponse = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceArray(TagResponseDto, {
      description: 'Returns the related tags.',
      example: TAG_RELATED_LIST_EXAMPLE,
    }),
    ApiBadRequestResponse(problem.badRequest(relatedBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(relatedNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(relatedInternalErrorExample)),
  );

export const ApiTagAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof TagAnalyticsResponseDto>(
      TagAnalyticsResponseDto as unknown as Type,
      'Returns the tag analytics.',
      TAG_ANALYTICS_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(analyticsBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(analyticsNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(analyticsInternalErrorExample)),
  );

export const ApiFollowTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    resourceOk<typeof TagFollowMessageResponseDto>(
      TagFollowMessageResponseDto as unknown as Type,
      'Confirms the tag was followed.',
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
    resourceOk<typeof TagFollowMessageResponseDto>(
      TagFollowMessageResponseDto as unknown as Type,
      'Confirms the tag was unfollowed.',
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
    resourceOk<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'Returns the restored tag.',
      TAG_RESTORED_EXAMPLE,
    ),
    ApiUnauthorizedResponse(problem.unauthorized(restoreUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(restoreForbiddenExample)),
    ApiNotFoundResponse(problem.notFound(restoreNotFoundExample)),
    ApiConflictResponse(problem.conflict(restoreConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(restoreInternalErrorExample)),
  );

export const ApiListTagsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceList<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'cursor',
      'Returns the requested tags.',
      TAG_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(listTagsBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(listTagsInternalErrorExample)),
  );

export const ApiTagBySlugResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'Returns the requested tag.',
      TAG_DETAIL_EXAMPLE,
    ),
    ApiNotFoundResponse(problem.notFound(tagBySlugNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(tagBySlugInternalErrorExample)),
  );

export const ApiCreateTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    resourceCreated<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'Returns the created tag.',
      TAG_CREATED_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(createTagBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(createTagUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(createTagForbiddenExample)),
    ApiConflictResponse(problem.conflict(createTagConflictExample)),
    ApiInternalServerErrorResponse(problem.internalError(createTagInternalErrorExample)),
  );

export const ApiUpdateTagResponse = (): MethodDecorator =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    resourceOk<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'Returns the updated tag.',
      TAG_UPDATED_EXAMPLE,
    ),
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
    resourceOk<typeof DeleteTagResponseDto>(
      DeleteTagResponseDto as unknown as Type,
      'Confirms the tag was deleted.',
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
    resourceList<typeof FollowedTagItemDto>(
      FollowedTagItemDto as unknown as Type,
      'cursor',
      'Returns the followed tags.',
      TAG_FOLLOWED_LIST_EXAMPLE,
    ),
    ApiBadRequestResponse(problem.badRequest(followedTagsBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(followedTagsUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(followedTagsForbiddenExample)),
    ApiInternalServerErrorResponse(problem.internalError(followedTagsInternalErrorExample)),
  );

/**
 * Documents the `:id` path parameter as a UUID, mirroring the runtime
 * `ParseUUIDPipe` enforcement on every admin/mutation tag endpoint.
 *
 * Without this decorator the OpenAPI generator renders the parameter as a
 * plain `{ type: 'string' }` with no format hint — generated SDKs (Orval,
 * OpenAPI Generator) would emit `string` instead of `UUID`, dropping the
 * type safety that `ParseUUIDPipe` provides at runtime.
 *
 * Phase 3 of `docs/api-contract-audit-tag.md`.
 */
export const ApiTagIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'id',
    description: 'UUID of the tag',
    format: 'uuid',
    example: '770e8400-e29b-41d4-a716-446655440000',
  });
