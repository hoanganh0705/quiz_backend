import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const AchievementProblemCodeMapping = {
  BADGE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/badge-not-found',
  },
  ACHIEVEMENT_USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/achievement-user-not-found',
  },
  USER_BADGE_OWNERSHIP_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-badge-ownership-not-found',
  },
  ACHIEVEMENT_GRANT_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/achievement-grant-error',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
