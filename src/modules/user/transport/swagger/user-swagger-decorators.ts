import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ErrorResponseExamples, ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import {
  UserWrappedActivityDto,
  UserWrappedAnalyticsDto,
  UserWrappedBadgesDto,
  UserWrappedCreatorAnalyticsDto,
  UserWrappedMeDto,
  UserWrappedMyTournamentAnalyticsDto,
  UserWrappedMyTournamentHistoryDto,
  UserWrappedMyTournamentsDto,
  UserWrappedPublicTournamentProfileDto,
  UserWrappedRankingDto,
  UserWrappedRelatedQuizzesDto,
  UserWrappedUserQuizzesDto,
} from '../../dto/response/user-response-docs.dto';
import {
  USER_ACTIVITY_EXAMPLE,
  USER_ANALYTICS_EXAMPLE,
  USER_BADGES_EXAMPLE,
  USER_CREATOR_QUIZ_ANALYTICS_EXAMPLE,
  USER_ME_EXAMPLE,
  USER_ME_SETTINGS_UPDATED_EXAMPLE,
  USER_ME_UPDATED_EXAMPLE,
  USER_MY_TOURNAMENTS_EXAMPLE,
  USER_RANKING_EXAMPLE,
  USER_RECOMMENDED_QUIZZES_EXAMPLE,
  USER_TOURNAMENT_ANALYTICS_EXAMPLE,
  USER_TOURNAMENT_HISTORY_EXAMPLE,
  USER_TOURNAMENT_PROFILE_EXAMPLE,
  USER_QUIZZES_EXAMPLE,
} from './examples';

// ─── Shared 200 OK response factory ──────────────────────────────────────────────
//
// Wraps ApiOkResponse so every success decorator below can stay a one-liner.
// Returns a MethodDecorator that NestJS will apply at class-evaluation time.
const createOkResponse = (
  description: string,
  type: Type<unknown>,
  example: object,
): MethodDecorator =>
  ApiOkResponse({
    description,
    type,
    example,
  });

// ─── Standard error response options ─────────────────────────────────────────────

export const badRequestOptions = {
  description: 'Request body, query, or params failed validation',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.badRequest,
};

export const notFoundOptions = {
  description: 'The requested user or resource does not exist',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.notFound,
};

export const forbiddenOptions = {
  description: 'The profile is private and cannot be accessed',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.forbidden,
};

export const internalErrorOptions = {
  description: 'Unexpected server error',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.internalServerError,
};

// ─── 200 OK response decorators ──────────────────────────────────────────────────
//
// Each decorator describes a single endpoint's success envelope. The
// exported names are kept stable so controllers don't need to change.

export const ApiUserMeResponse = (): MethodDecorator =>
  createOkResponse('Returns profile.', UserWrappedMeDto, USER_ME_EXAMPLE);

export const ApiUserMeUpdatedResponse = (): MethodDecorator =>
  createOkResponse('Updates profile.', UserWrappedMeDto, USER_ME_UPDATED_EXAMPLE);

export const ApiUserSettingsUpdatedResponse = (): MethodDecorator =>
  createOkResponse('Updates settings.', UserWrappedMeDto, USER_ME_SETTINGS_UPDATED_EXAMPLE);

export const ApiUserBadgesResponse = (): MethodDecorator =>
  createOkResponse('Returns badges.', UserWrappedBadgesDto, USER_BADGES_EXAMPLE);

export const ApiUserActivityResponse = (): MethodDecorator =>
  createOkResponse('Returns activity.', UserWrappedActivityDto, USER_ACTIVITY_EXAMPLE);

export const ApiUserRankingResponse = (): MethodDecorator =>
  createOkResponse('Returns ranking.', UserWrappedRankingDto, USER_RANKING_EXAMPLE);

export const ApiUserAnalyticsResponse = (): MethodDecorator =>
  createOkResponse('Returns analytics.', UserWrappedAnalyticsDto, USER_ANALYTICS_EXAMPLE);

export const ApiMyTournamentsResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns my tournaments.',
    UserWrappedMyTournamentsDto,
    USER_MY_TOURNAMENTS_EXAMPLE,
  );

export const ApiMyTournamentHistoryResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns my tournament history.',
    UserWrappedMyTournamentHistoryDto,
    USER_TOURNAMENT_HISTORY_EXAMPLE,
  );

export const ApiPublicTournamentHistoryResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns tournament history.',
    UserWrappedMyTournamentHistoryDto,
    USER_TOURNAMENT_HISTORY_EXAMPLE,
  );

export const ApiMyTournamentAnalyticsResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns my tournament analytics.',
    UserWrappedMyTournamentAnalyticsDto,
    USER_TOURNAMENT_ANALYTICS_EXAMPLE,
  );

export const ApiPublicTournamentProfileResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns tournament profile.',
    UserWrappedPublicTournamentProfileDto,
    USER_TOURNAMENT_PROFILE_EXAMPLE,
  );

export const ApiUserQuizListResponse = (): MethodDecorator =>
  createOkResponse('Returns quizzes.', UserWrappedUserQuizzesDto, USER_QUIZZES_EXAMPLE);

export const ApiCreatorQuizAnalyticsResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns quiz analytics.',
    UserWrappedCreatorAnalyticsDto,
    USER_CREATOR_QUIZ_ANALYTICS_EXAMPLE,
  );

export const ApiRecommendedQuizzesResponse = (): MethodDecorator =>
  createOkResponse(
    'Returns recommended quizzes.',
    UserWrappedRelatedQuizzesDto,
    USER_RECOMMENDED_QUIZZES_EXAMPLE,
  );

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
