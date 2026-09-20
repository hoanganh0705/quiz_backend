import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const UserProblemCodeMapping = {
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-not-found',
  },
  USER_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-analytics-not-found',
  },
  USER_PROFILE_PRIVATE: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/user-profile-private',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
