import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const TagProblemCodeMapping = {
  TAG_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tag-not-found',
  },
  TAG_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tag-analytics-not-found',
  },
  TAG_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tag-slug-conflict',
  },
  TAG_ALREADY_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tag-already-active',
  },
  TAG_RESTORE_INVARIANT: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/tag-restore-invariant',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
