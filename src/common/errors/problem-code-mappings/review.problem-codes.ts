import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const ReviewProblemCodeMapping = {
  REVIEW_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/review-not-found',
  },
  REVIEW_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/review-forbidden',
  },
  REVIEW_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/review-conflict',
  },
  REVIEW_ALREADY_REPORTED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/review-already-reported',
  },
  REVIEW_VALIDATION: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/review-validation',
  },
  REVIEW_ATTEMPT_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/review-attempt-required',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
