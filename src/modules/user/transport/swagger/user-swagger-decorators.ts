import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ErrorResponseExamples, ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { UserMeResponseDto } from '../../dto/response/user-me.dto';
import { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import { UserBadgesResponseDto } from '../../dto/response/user-badges.dto';
import { UserActivityResponseDto } from '../../dto/response/user-activity.dto';
import { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history.dto';
import { MyTournamentsResponseDto } from '../../dto/response/my-tournaments.dto';
import { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { QuizResponseDto } from '@/modules/quiz/dto/response/quiz-response.dto';

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
  ApiOkResource(UserMeResponseDto, { description: 'Returns profile.' });

export const ApiUserMeUpdatedResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, { description: 'Updates profile.' });

export const ApiUserSettingsUpdatedResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, { description: 'Updates settings.' });

export const ApiUserBadgesResponse = (): MethodDecorator =>
  ApiOkResourceList(UserBadgesResponseDto, 'cursor', { description: 'Returns badges.' });

export const ApiUserActivityResponse = (): MethodDecorator =>
  ApiOkResourceList(UserActivityResponseDto, 'cursor', { description: 'Returns activity.' });

export const ApiUserRankingResponse = (): MethodDecorator =>
  ApiOkResource(UserRankingResponseDto, { description: 'Returns ranking.' });

export const ApiUserAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(UserAnalyticsResponseDto, { description: 'Returns analytics.' });

export const ApiMyTournamentsResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentsResponseDto, 'cursor', { description: 'Returns my tournaments.' });

export const ApiMyTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentHistoryResponseDto, 'cursor', {
    description: 'Returns my tournament history.',
  });

export const ApiPublicTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentHistoryResponseDto, 'cursor', {
    description: 'Returns tournament history.',
  });

export const ApiMyTournamentAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(MyTournamentAnalyticsResponseDto, {
    description: 'Returns my tournament analytics.',
  });

export const ApiPublicTournamentProfileResponse = (): MethodDecorator =>
  ApiOkResource(PublicTournamentProfileResponseDto, {
    description: 'Returns tournament profile.',
  });

export const ApiUserQuizListResponse = (): MethodDecorator =>
  ApiOkResourceList(QuizListResponseDto, 'cursor', { description: 'Returns quizzes.' });

export const ApiCreatorQuizAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(CreatorQuizAnalyticsDto, { description: 'Returns quiz analytics.' });

export const ApiRecommendedQuizzesResponse = (): MethodDecorator =>
  ApiOkResourceList(QuizResponseDto, 'cursor', { description: 'Returns recommended quizzes.' });

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
