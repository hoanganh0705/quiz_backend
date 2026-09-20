import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const DailyChallengeProblemCodeMapping = {
  DAILY_CHALLENGE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/daily-challenge-not-found',
  },
  DAILY_CHALLENGE_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/daily-challenge-conflict',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
