import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const QuizProblemCodeMapping = {
  QUIZ_OPERATION_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/quiz-operation-failed',
  },
  QUIZ_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/quiz-not-found',
  },
  QUIZ_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/quiz-forbidden',
  },
  QUIZ_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-slug-conflict',
  },
  QUIZ_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-conflict',
  },
  QUIZ_VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/quiz-validation-failed',
  },
  QUIZ_VERSION_IMMUTABLE: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/quiz-version-immutable',
  },
  QUIZ_VERSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/quiz-version-not-found',
  },
  QUIZ_INSUFFICIENT_QUESTIONS: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/quiz-insufficient-questions',
  },
  QUIZ_QUESTION_POSITION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-question-position-conflict',
  },
  QUIZ_ANSWER_OPTION_POSITION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-answer-option-position-conflict',
  },
  QUIZ_MULTIPLE_CORRECT_OPTIONS: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/quiz-multiple-correct-options',
  },
  QUIZ_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/quiz-analytics-not-found',
  },
  QUIZ_ANALYTICS_CALCULATION_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/quiz-analytics-calculation-failed',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
