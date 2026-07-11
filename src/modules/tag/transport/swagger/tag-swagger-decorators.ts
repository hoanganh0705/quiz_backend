import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { FollowedTagItemDto } from '../../dto/response/parity-response.dto';
import { DeleteTagResponseDto } from '../../dto/response/delete-tag-response.dto';
import {
  RankedTagResponseDto,
  TagAnalyticsResponseDto,
  TagFollowMessageResponseDto,
} from '../../dto/response/parity-response.dto';
import { TagResponseDto } from '../../dto/response/tag-response.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
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

const resourceOk = <T extends Type>(model: T, description: string) =>
  ApiOkResource(model, { description });

const resourceCreated = <T extends Type>(model: T, description: string) =>
  ApiCreatedResource(model, { description });

const resourceList = <T extends Type>(model: T, kind: 'cursor' | 'offset', description: string) =>
  ApiOkResourceList(model, kind, { description });

export const ApiPopularTagsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof RankedTagResponseDto>(
      RankedTagResponseDto as unknown as Type,
      'Returns the ranked tags.',
    ),
    ApiBadRequestResponse(problem.badRequest(popularBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(popularInternalErrorExample)),
  );

export const ApiTrendingTagsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof RankedTagResponseDto>(
      RankedTagResponseDto as unknown as Type,
      'Returns the ranked tags.',
    ),
    ApiBadRequestResponse(problem.badRequest(trendingBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(trendingInternalErrorExample)),
  );

export const ApiTagQuizzesResponse = (): MethodDecorator =>
  applyDecorators(
    resourceList<typeof QuizListResponseDto>(
      QuizListResponseDto as unknown as Type,
      'cursor',
      'Returns the quizzes in the tag.',
    ),
    ApiNotFoundResponse(problem.notFound(tagQuizzesNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(tagQuizzesInternalErrorExample)),
  );

export const ApiRelatedTagsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'Returns the related tags.',
    ),
    ApiBadRequestResponse(problem.badRequest(relatedBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(relatedNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(relatedInternalErrorExample)),
  );

export const ApiTagAnalyticsResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof TagAnalyticsResponseDto>(
      TagAnalyticsResponseDto as unknown as Type,
      'Returns the tag analytics.',
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
    ),
    ApiBadRequestResponse(problem.badRequest(listTagsBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(listTagsInternalErrorExample)),
  );

export const ApiTagBySlugResponse = (): MethodDecorator =>
  applyDecorators(
    resourceOk<typeof TagResponseDto>(
      TagResponseDto as unknown as Type,
      'Returns the requested tag.',
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
    ),
    ApiBadRequestResponse(problem.badRequest(followedTagsBadRequestExample)),
    ApiUnauthorizedResponse(problem.unauthorized(followedTagsUnauthorizedExample)),
    ApiForbiddenResponse(problem.forbidden(followedTagsForbiddenExample)),
    ApiInternalServerErrorResponse(problem.internalError(followedTagsInternalErrorExample)),
  );
