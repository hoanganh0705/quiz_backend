import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const CategoryProblemCodeMapping = {
  CATEGORY_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/category-not-found',
  },
  CATEGORY_FOLLOW_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/category-follow-not-found',
  },
  CATEGORY_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/category-analytics-not-found',
  },
  CATEGORY_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/category-slug-conflict',
  },
  CATEGORY_ALREADY_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/category-already-active',
  },
  CATEGORY_RESTORE_INVARIANT: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/category-restore-invariant',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
