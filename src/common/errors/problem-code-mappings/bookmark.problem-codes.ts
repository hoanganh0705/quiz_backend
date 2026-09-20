import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const BookmarkProblemCodeMapping = {
  BOOKMARK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/bookmark-not-found',
  },
  BOOKMARK_COLLECTION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/bookmark-collection-not-found',
  },
  COLLECTION_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/collection-forbidden',
  },
  BOOKMARK_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/bookmark-conflict',
  },
  COLLECTION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/collection-conflict',
  },
  BOOKMARK_VALIDATION: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/bookmark-validation',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
