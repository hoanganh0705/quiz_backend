import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { ProblemDetailDto } from '@/common/swagger/swagger-schemas';
import {
  DailyChallengeAnswerResponseDto,
  DailyChallengeHistoryResponseDto,
  DailyChallengeLeaderboardResponseDto,
} from '../../dto/response/daily-challenge-history-response.dto';
import { DailyChallengeResponseDto } from '../../dto/response/daily-challenge-response.dto';

/**
 * Phase 3 (S-14): Swagger decorator factory for the daily-challenge
 * endpoints. Each endpoint gets a single `200` / `400` / `404`
 * / `500` decorator stack with the appropriate response schema.
 */

const problem = {
  badRequest: (example: unknown) => ({
    description: 'Bad request',
    type: ProblemDetailDto,
    example,
  }),
  conflict: (example: unknown) => ({
    description: 'Conflict',
    type: ProblemDetailDto,
    example,
  }),
  notFound: (example: unknown) => ({
    description: 'Not found',
    type: ProblemDetailDto,
    example,
  }),
  unauthorized: (example: unknown) => ({
    description: 'Unauthorized',
    type: ProblemDetailDto,
    example,
  }),
  internalError: (example: unknown) => ({
    description: 'Internal server error',
    type: ProblemDetailDto,
    example,
  }),
};

const dailyChallengeNotFoundExample = {
  type: 'https://api.quiz.local/problems/daily-challenge-not-found',
  title: 'NotFound',
  status: 404,
  detail: 'No active daily challenge for today.',
  instance: '/daily-challenge/today',
};

const dailyChallengeInternalErrorExample = {
  type: 'https://api.quiz.local/problems/internal-server-error',
  title: 'InternalServerError',
  status: 500,
  detail: 'Daily challenge query failed.',
  instance: '/daily-challenge/today',
};

const dailyChallengeConflictExample = {
  type: 'https://api.quiz.local/problems/daily-challenge-conflict',
  title: 'Conflict',
  status: 409,
  detail: 'Daily challenge attempt is out of sync with the next question index.',
  instance: '/daily-challenge/answer',
};

const dailyChallengeBadRequestExample = {
  type: 'https://api.quiz.local/problems/validation-error',
  title: 'BadRequest',
  status: 400,
  detail: 'Invalid answer payload.',
  instance: '/daily-challenge/answer',
};

const dailyChallengeUnauthorizedExample = {
  type: 'https://api.quiz.local/problems/unauthorized',
  title: 'Unauthorized',
  status: 401,
  detail: 'Authentication required.',
  instance: '/daily-challenge/answer',
};

export const ApiDailyChallengeToday = (): MethodDecorator =>
  applyDecorators(
    ApiOkResource(DailyChallengeResponseDto as unknown as Type, {
      description: "Returns the day's daily-challenge snapshot.",
    }),
    ApiNotFoundResponse(problem.notFound(dailyChallengeNotFoundExample)),
    ApiInternalServerErrorResponse(problem.internalError(dailyChallengeInternalErrorExample)),
  );

export const ApiDailyChallengeHistory = (): MethodDecorator =>
  applyDecorators(
    ApiOkResourceList(DailyChallengeHistoryResponseDto as unknown as Type, 'cursor', {
      description: 'Cursor-paginated completed daily-challenge history for the viewer.',
    }),
    ApiUnauthorizedResponse(problem.unauthorized(dailyChallengeUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(dailyChallengeInternalErrorExample)),
  );

export const ApiDailyChallengeLeaderboard = (): MethodDecorator =>
  applyDecorators(
    ApiOkResource(DailyChallengeLeaderboardResponseDto as unknown as Type, {
      description: 'Daily-challenge leaderboard for the supplied period.',
    }),
    ApiBadRequestResponse(problem.badRequest(dailyChallengeBadRequestExample)),
    ApiInternalServerErrorResponse(problem.internalError(dailyChallengeInternalErrorExample)),
  );

export const ApiDailyChallengeAnswer = (): MethodDecorator =>
  applyDecorators(
    ApiOkResource(DailyChallengeAnswerResponseDto as unknown as Type, {
      description:
        'Acknowledgement for an answer submission. The next question index is `null` when the attempt is complete.',
    }),
    ApiBadRequestResponse(problem.badRequest(dailyChallengeBadRequestExample)),
    ApiNotFoundResponse(problem.notFound(dailyChallengeNotFoundExample)),
    ApiConflictResponse(problem.conflict(dailyChallengeConflictExample)),
    ApiUnauthorizedResponse(problem.unauthorized(dailyChallengeUnauthorizedExample)),
    ApiInternalServerErrorResponse(problem.internalError(dailyChallengeInternalErrorExample)),
  );
