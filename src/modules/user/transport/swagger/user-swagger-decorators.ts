import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ErrorResponseExamples, ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { ApiOkResource, ApiOkResourceArray, ApiOkResourceList } from '@/common/swagger/api-ok';
import { UserMeResponseDto } from '../../dto/response/user-me.dto';
import { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import { UserBadgeItemDto } from '../../dto/response/user-badges.dto';
import { UserActivityItemDto } from '../../dto/response/user-activity.dto';
import { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history.dto';
import { MyTournamentsResponseDto } from '../../dto/response/my-tournaments.dto';
import { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { QuizListItemDto } from '@/modules/quiz/dto/response/quiz-list-item.dto';
import {
  USER_ME_EXAMPLE,
  USER_ME_UPDATED_EXAMPLE,
  USER_ME_SETTINGS_UPDATED_EXAMPLE,
} from './examples/me.examples';
import { USER_BADGES_EXAMPLE, USER_ACTIVITY_EXAMPLE } from './examples/badges.examples';
import {
  USER_RANKING_EXAMPLE,
  USER_ANALYTICS_EXAMPLE,
  USER_CREATOR_QUIZ_ANALYTICS_EXAMPLE,
} from './examples/analytics.examples';
import {
  USER_RECOMMENDED_QUIZZES_EXAMPLE,
  USER_QUIZZES_EXAMPLE,
} from './examples/quizzes.examples';
import {
  USER_TOURNAMENT_PROFILE_EXAMPLE,
  USER_TOURNAMENT_HISTORY_EXAMPLE,
  USER_TOURNAMENT_ANALYTICS_EXAMPLE,
  USER_MY_TOURNAMENTS_EXAMPLE,
} from './examples/tournaments.examples';

// ─── Standard error response options ─────────────────────────────────────────────

export const badRequestOptions = {
  description: 'Request body, query, or params failed validation',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.badRequest,
};

/**
 * Phase 2.5 (H7): Instance path uses `/users/{userId}/...` instead of the
 * misleading `/quizzes/...` from the global error examples.
 */
export const notFoundOptions = {
  description: 'The requested user or resource does not exist',
  type: ProblemDetailDto,
  example: {
    ...ErrorResponseExamples.notFound,
    instance: '/users/660e8400-e29b-41d4-a716-446655440000',
  },
};

/**
 * Phase 2.5 (H7): Instance path uses `/users/{userId}/...` instead of the
 * misleading `/quizzes/...` from the global global error examples.
 */
export const forbiddenOptions = {
  description: 'The profile is private and cannot be accessed',
  type: ProblemDetailDto,
  example: {
    ...ErrorResponseExamples.forbidden,
    instance: '/users/660e8400-e29b-41d4-a716-446655440000/badges',
  },
};

export const internalErrorOptions = {
  description: 'Unexpected server error',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.internalServerError,
};

// ─── 200 OK response decorators ──────────────────────────────────────────────────
//
// Phase 4.4 (L4): All decorators now pass `example` through ApiResourceOptions
// to generate a live example in the Swagger UI and the generated OpenAPI spec.

export const ApiUserMeResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, {
    description: 'Returns profile.',
    example: USER_ME_EXAMPLE,
  });

export const ApiUserMeUpdatedResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, {
    description: 'Updates profile.',
    example: USER_ME_UPDATED_EXAMPLE,
  });

export const ApiUserSettingsUpdatedResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, {
    description: 'Updates settings.',
    example: USER_ME_SETTINGS_UPDATED_EXAMPLE,
  });

/**
 * Phase 2.1 (H1): Use the item DTOs for the list item type.
 * Before: `ApiOkResourceList(UserBadgesResponseDto, ...)` generated
 *   `data: UserBadgesResponseDto[]`  ← wrong (it's the wrapper, not the item)
 * After:  `ApiOkResourceList(UserBadgeItemDto, ...)` generates
 *   `data: UserBadgeItemDto[]`      ← matches the wire shape
 */
export const ApiUserBadgesResponse = (): MethodDecorator =>
  ApiOkResourceList(UserBadgeItemDto, 'cursor', {
    description: 'Returns badges.',
    example: USER_BADGES_EXAMPLE,
  });

/**
 * Phase 2.1 (H1): Use the item DTO for activity list items.
 */
export const ApiUserActivityResponse = (): MethodDecorator =>
  ApiOkResourceList(UserActivityItemDto, 'cursor', {
    description: 'Returns activity.',
    example: USER_ACTIVITY_EXAMPLE,
  });

/**
 * Phase 4.1 (L1): Documents the write-on-read upsert side effect.
 */
export const ApiUserRankingResponse = (): MethodDecorator =>
  ApiOkResource(UserRankingResponseDto, {
    description:
      'Returns ranking. Note: the first call for a user with no ranking record creates one (write-on-read).',
    example: USER_RANKING_EXAMPLE,
  });

export const ApiUserAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(UserAnalyticsResponseDto, {
    description: 'Returns analytics.',
    example: USER_ANALYTICS_EXAMPLE,
  });

export const ApiMyTournamentsResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentsResponseDto, 'cursor', {
    description: 'Returns my tournaments.',
    example: USER_MY_TOURNAMENTS_EXAMPLE,
  });

export const ApiMyTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentHistoryResponseDto, 'cursor', {
    description: 'Returns my tournament history.',
    example: USER_TOURNAMENT_HISTORY_EXAMPLE,
  });

export const ApiPublicTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentHistoryResponseDto, 'cursor', {
    description: 'Returns tournament history.',
    example: USER_TOURNAMENT_HISTORY_EXAMPLE,
  });

export const ApiMyTournamentAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(MyTournamentAnalyticsResponseDto, {
    description: 'Returns my tournament analytics.',
    example: USER_TOURNAMENT_ANALYTICS_EXAMPLE,
  });

export const ApiPublicTournamentProfileResponse = (): MethodDecorator =>
  ApiOkResource(PublicTournamentProfileResponseDto, {
    description: 'Returns tournament profile.',
    example: USER_TOURNAMENT_PROFILE_EXAMPLE,
  });

export const ApiUserQuizListResponse = (): MethodDecorator =>
  ApiOkResourceList(QuizListResponseDto, 'cursor', {
    description: 'Returns quizzes.',
    example: USER_QUIZZES_EXAMPLE,
  });

export const ApiCreatorQuizAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(CreatorQuizAnalyticsDto, {
    description: 'Returns quiz analytics.',
    example: USER_CREATOR_QUIZ_ANALYTICS_EXAMPLE,
  });

/**
 * Phase 2.2 (H2): Runtime returns a bare array (`{ data: QuizListItemDto[], meta: { timestamp } }`),
 * not `WrappedPaginatedDto`. Switch from `ApiOkResourceList` to `ApiOkResourceArray`.
 *
 * Wire shape verified in `user.presenter.ts:84`:
 *   `ApiResponse.ok([...dto.items])`  ← bare array, no pagination meta
 */
export const ApiRecommendedQuizzesResponse = (): MethodDecorator =>
  ApiOkResourceArray(QuizListItemDto, {
    description: 'Returns recommended quizzes.',
    example: USER_RECOMMENDED_QUIZZES_EXAMPLE,
  });

// ─── Composed error response decorators ───────────────────────────────────────────
//
// Each decorator bundles the error responses that always travel together.
// Names describe the HTTP status codes, not specific endpoints.

/** 500 only — internal error for authenticated endpoints. */
export const ApiInternalError = (): MethodDecorator =>
  ApiInternalServerErrorResponse(internalErrorOptions);

/** 400 + 500 — validation + internal error for endpoints that accept validated input. */
export const ApiBadRequestAndInternal = (): MethodDecorator =>
  applyDecorators(
    ApiBadRequestResponse(badRequestOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

/** 404 + 500 — resource not found + internal error. */
export const ApiNotFoundAndInternal = (): MethodDecorator =>
  applyDecorators(
    ApiNotFoundResponse(notFoundOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

/** 404 + 400 + 500 — not found + validation + internal error. */
export const ApiNotFoundBadRequestInternal = (): MethodDecorator =>
  applyDecorators(
    ApiNotFoundResponse(notFoundOptions),
    ApiBadRequestResponse(badRequestOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

/** 404 + 403 + 500 — not found + privacy-forbidden + internal error. */
export const ApiNotFoundForbiddenInternal = (): MethodDecorator =>
  applyDecorators(
    ApiNotFoundResponse(notFoundOptions),
    ApiForbiddenResponse(forbiddenOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

/** 404 + 400 + 403 + 500 — not found + validation + privacy-forbidden + internal error. */
export const ApiNotFoundBadRequestForbiddenInternal = (): MethodDecorator =>
  applyDecorators(
    ApiNotFoundResponse(notFoundOptions),
    ApiBadRequestResponse(badRequestOptions),
    ApiForbiddenResponse(forbiddenOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

// ─── Parameter decorators ───────────────────────────────────────────────────────

// ─── Parameter decorators ───────────────────────────────────────────────────────

/**
 * Phase 3.4 (M5): Documents `userId` path parameter as `format: uuid` in OpenAPI.
 * Runtime UUID enforcement is already handled by `ParseUUIDPipe` in the controller.
 */
export const ApiUserIdParam = () =>
  ApiParam({
    name: 'userId',
    description: 'UUID of the target user',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  });
