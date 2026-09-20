import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const RankingProblemCodeMapping = {
  RANKING_INVALID_XP_EVENT: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/ranking-invalid-xp-event',
  },
  RANKING_RANK_CALCULATION_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/ranking-rank-calculation-error',
  },

  RANKING_PERIOD_RESET_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/ranking-period-reset-error',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
