import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const AttemptProblemCodeMapping = {
  ATTEMPT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/attempt-not-found',
  },
  ATTEMPT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/attempt-forbidden',
  },
  ATTEMPT_VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/attempt-validation-failed',
  },
  ATTEMPT_ALREADY_STARTED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/attempt-already-started',
  },
  ATTEMPT_NOT_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/attempt-not-active',
  },
  ATTEMPT_QUESTION_ALREADY_ANSWERED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/attempt-question-already-answered',
  },
  ATTEMPT_QUIZ_NOT_PUBLISHED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/attempt-quiz-not-published',
  },
  ATTEMPT_QUESTION_INVALID: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/attempt-question-invalid',
  },
  ATTEMPT_NOT_COMPLETED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/attempt-not-completed',
  },
  ATTEMPT_ANSWER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/attempt-answer-not-found',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
