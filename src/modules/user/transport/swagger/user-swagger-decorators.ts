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
import { UserLookupResponseDto } from '../../dto/response/user-lookup.dto';
import { UserSummaryResponseDto } from '../../dto/response/user-summary.dto';
import { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import { UserBadgeItemDto } from '../../dto/response/user-badges.dto';
import { UserActivityItemDto } from '../../dto/response/user-activity.dto';
import { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import { MyTournamentHistoryItemDto } from '../../dto/response/my-tournament-history.dto';
import { MyTournamentItemDto } from '../../dto/response/my-tournaments.dto';
import { PublicTournamentHistoryItemDto } from '../../dto/response/public-tournament-history.dto';
import { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';
import { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { QuizListItemDto } from '@/modules/quiz/dto/response/quiz-list-item.dto';
import {
  USER_ME_EXAMPLE,
  USER_ME_UPDATED_EXAMPLE,
  USER_ME_SETTINGS_UPDATED_EXAMPLE,
} from './examples/me.examples';
import { USER_LOOKUP_EXAMPLE } from './examples/lookup.examples';
import { USER_ME_SUMMARY_EXAMPLE } from './examples/summary.examples';
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

export const badRequestOptions = {
  description: 'Request body, query, or params failed validation',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.badRequest,
};

export const notFoundOptions = {
  description: 'The requested user or resource does not exist',
  type: ProblemDetailDto,
  example: {
    ...ErrorResponseExamples.notFound,
    instance: '/users/660e8400-e29b-71d4-a716-446655440000',
  },
};

export const forbiddenOptions = {
  description: 'The profile is private and cannot be accessed',
  type: ProblemDetailDto,
  example: {
    ...ErrorResponseExamples.forbidden,
    instance: '/users/660e8400-e29b-71d4-a716-446655440000/badges',
  },
};

export const internalErrorOptions = {
  description: 'Unexpected server error',
  type: ProblemDetailDto,
  example: ErrorResponseExamples.internalServerError,
};

/**
 * Composes one or more `@nestjs/swagger` `@ApiXxxResponse` decorators
 * into a single `MethodDecorator`. Replaces the repeated
 * `applyDecorators(ApiA…, ApiB…, ApiC…)` boilerplate that was inline
 * in every `Api*AndInternal` helper.
 */
const combineResponses = (...decorators: MethodDecorator[]): MethodDecorator =>
  applyDecorators(...decorators);

export const ApiUserMeResponse = (): MethodDecorator =>
  ApiOkResource(UserMeResponseDto, {
    description: 'Returns profile.',
    example: USER_ME_EXAMPLE,
  });

export const ApiUserLookupResponse = (): MethodDecorator =>
  ApiOkResource(UserLookupResponseDto, {
    description: 'Returns the public identity projection for the requested username.',
    example: USER_LOOKUP_EXAMPLE,
  });

export const ApiUserSummaryResponse = (): MethodDecorator =>
  ApiOkResource(UserSummaryResponseDto, {
    description:
      'Returns the composite profile summary for the authenticated user. ' +
      'Composed from `/users/me`, the level projection, creator quiz analytics, ' +
      'user analytics, and social counts.',
    example: USER_ME_SUMMARY_EXAMPLE,
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

export const ApiUserBadgesResponse = (): MethodDecorator =>
  ApiOkResourceList(UserBadgeItemDto, 'cursor', {
    description: 'Returns badges.',
    example: USER_BADGES_EXAMPLE,
  });

export const ApiUserActivityResponse = (): MethodDecorator =>
  ApiOkResourceList(UserActivityItemDto, 'cursor', {
    description:
      "Returns activity. Honours the authenticated user's `showActivity` " +
      'privacy flag (403 when the flag is false and the requester is not the owner).',
    example: USER_ACTIVITY_EXAMPLE,
  });

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
  ApiOkResourceList(MyTournamentItemDto, 'cursor', {
    description: 'Returns my tournaments.',
    example: USER_MY_TOURNAMENTS_EXAMPLE,
  });

export const ApiMyTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(MyTournamentHistoryItemDto, 'cursor', {
    description: "Returns the authenticated user's tournament completion history, newest first.",
    example: USER_TOURNAMENT_HISTORY_EXAMPLE,
  });

export const ApiPublicTournamentHistoryResponse = (): MethodDecorator =>
  ApiOkResourceList(PublicTournamentHistoryItemDto, 'cursor', {
    description:
      "Returns the target user's public tournament completion history, newest first. " +
      "Honours the target user's `showTournamentActivity` privacy flag (403 when the flag " +
      'is false and the requester is not the owner).',
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
  ApiOkResourceList(QuizListItemDto, 'cursor', {
    description: 'Returns quizzes.',
    example: USER_QUIZZES_EXAMPLE,
  });

export const ApiCreatorQuizAnalyticsResponse = (): MethodDecorator =>
  ApiOkResource(CreatorQuizAnalyticsDto, {
    description: 'Returns quiz analytics.',
    example: USER_CREATOR_QUIZ_ANALYTICS_EXAMPLE,
  });

export const ApiRecommendedQuizzesResponse = (): MethodDecorator =>
  ApiOkResourceArray(QuizListItemDto, {
    description: 'Returns recommended quizzes.',
    example: USER_RECOMMENDED_QUIZZES_EXAMPLE,
  });

export const ApiInternalError = (): MethodDecorator =>
  ApiInternalServerErrorResponse(internalErrorOptions);

export const ApiBadRequestAndInternal = (): MethodDecorator =>
  combineResponses(
    ApiBadRequestResponse(badRequestOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

export const ApiNotFoundAndInternal = (): MethodDecorator =>
  combineResponses(
    ApiNotFoundResponse(notFoundOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

export const ApiNotFoundBadRequestInternal = (): MethodDecorator =>
  combineResponses(
    ApiNotFoundResponse(notFoundOptions),
    ApiBadRequestResponse(badRequestOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

export const ApiNotFoundForbiddenInternal = (): MethodDecorator =>
  combineResponses(
    ApiNotFoundResponse(notFoundOptions),
    ApiForbiddenResponse(forbiddenOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

export const ApiNotFoundBadRequestForbiddenInternal = (): MethodDecorator =>
  combineResponses(
    ApiNotFoundResponse(notFoundOptions),
    ApiBadRequestResponse(badRequestOptions),
    ApiForbiddenResponse(forbiddenOptions),
    ApiInternalServerErrorResponse(internalErrorOptions),
  );

export const ApiUserIdParam = () =>
  ApiParam({
    name: 'userId',
    description: 'UUID of the target user',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  });
