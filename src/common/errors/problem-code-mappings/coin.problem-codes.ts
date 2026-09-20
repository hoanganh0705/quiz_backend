import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const CoinProblemCodeMapping = {
  INSUFFICIENT_COINS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/insufficient-coins',
  },
  COIN_TIP_DAILY_CAP_EXCEEDED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    title: 'TooManyRequests',
    typeUri: 'https://api.quiz.local/problems/coin-tip-daily-cap-exceeded',
  },
  COIN_TIP_SELF_NOT_ALLOWED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/coin-tip-self-not-allowed',
  },
  COIN_TIP_RECIPIENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/coin-tip-recipient-not-found',
  },
  COIN_FLAIR_BADGE_NOT_OWNED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/coin-flair-badge-not-owned',
  },
  COIN_SUPPRESS_QUIZ_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/coin-suppress-quiz-not-found',
  },
  COIN_SUPPRESS_ALREADY_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/coin-suppress-already-active',
  },
  COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/coin-admin-adjustment-reason-required',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
