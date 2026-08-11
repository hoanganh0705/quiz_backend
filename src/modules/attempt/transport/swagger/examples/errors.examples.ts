import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

/**
 * Attempt module error examples with endpoint-correct `instance` paths.
 *
 * Every documented 4xx/5xx response uses the example returned by the matching
 * factory below, so the spec mirrors the URL the client actually requested.
 */

const withInstance = (
  base: Record<string, unknown>,
  instance: string,
): Record<string, unknown> => ({ ...base, instance });

// ─── Common errors ────────────────────────────────────────────────────────────

export const attemptNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

export const attemptForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

export const attemptUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts',
);

// ─── POST /quizzes/:quizId/attempts ──────────────────────────────────────────

export const startAttemptBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/attempts',
);

export const startAttemptUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/attempts',
);

export const startAttemptConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/attempts',
);

export const startAttemptUnprocessableExample = {
  type: 'https://quizapp.com/errors/quiz-not-published',
  title: 'Unprocessable Entity',
  status: 422,
  detail: 'This quiz is not published and cannot be attempted',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/attempts',
  code: 'ATTEMPT_QUIZ_NOT_PUBLISHED',
};

export const startAttemptInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/attempts',
);

// ─── GET /attempts/:attemptId ────────────────────────────────────────────────

export const getAttemptNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

export const getAttemptForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

export const getAttemptUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

export const getAttemptBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

export const getAttemptInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099',
);

// ─── POST /attempts/:attemptId/answers ───────────────────────────────────────

export const submitAnswerBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const submitAnswerUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const submitAnswerNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const submitAnswerForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const submitAnswerConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const submitAnswerUnprocessableExample = {
  type: 'https://quizapp.com/errors/attempt-question-invalid',
  title: 'Unprocessable Entity',
  status: 422,
  detail: 'Question is invalid for this attempt',
  instance: '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
  code: 'ATTEMPT_QUESTION_INVALID',
};

export const submitAnswerInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

// ─── DELETE /attempts/:attemptId/answers/:questionId ──────────────────────────

export const withdrawAnswerBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers/550e8400-e29b-71d4-a716-446655440001',
);

export const withdrawAnswerUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers/550e8400-e29b-71d4-a716-446655440001',
);

export const withdrawAnswerForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers/550e8400-e29b-71d4-a716-446655440001',
);

export const withdrawAnswerNotFoundExample = {
  type: 'https://quizapp.com/errors/attempt-answer-not-found',
  title: 'Not Found',
  status: 404,
  detail: 'Answer to withdraw not found',
  instance:
    '/attempts/550e8400-e29b-71d4-a716-446655440099/answers/550e8400-e29b-71d4-a716-446655440001',
  code: 'ATTEMPT_ANSWER_NOT_FOUND',
};

export const withdrawAnswerConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers/550e8400-e29b-71d4-a716-446655440001',
);

export const withdrawAnswerInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers/550e8400-e29b-71d4-a716-446655440001',
);

// ─── POST /attempts/:attemptId/abandon ───────────────────────────────────────

export const abandonAttemptNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/abandon',
);

export const abandonAttemptForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/abandon',
);

export const abandonAttemptUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/abandon',
);

export const abandonAttemptConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/abandon',
);

export const abandonAttemptBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/abandon',
);

export const abandonAttemptInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/abandon',
);

// ─── POST /attempts/:attemptId/complete ──────────────────────────────────────

export const completeAttemptNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/complete',
);

export const completeAttemptForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/complete',
);

export const completeAttemptUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/complete',
);

export const completeAttemptConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/complete',
);

export const completeAttemptBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/complete',
);

export const completeAttemptInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/complete',
);

// ─── GET /users/me/attempts ──────────────────────────────────────────────────

export const listMyAttemptsBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/users/me/attempts',
);

export const listMyAttemptsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/users/me/attempts',
);

export const listMyAttemptsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/users/me/attempts',
);

// ─── GET /users/me/attempts/stats ────────────────────────────────────────────

export const getMyAttemptStatsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/users/me/attempts/stats',
);

export const getMyAttemptStatsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/users/me/attempts/stats',
);

// ─── GET /attempts/:attemptId/answers ────────────────────────────────────────

export const getAttemptAnswersNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const getAttemptAnswersForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const getAttemptAnswersUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const getAttemptAnswersBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

export const getAttemptAnswersInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/answers',
);

// ─── GET /attempts/:attemptId/analytics ─────────────────────────────────────

export const getAttemptAnalyticsNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/analytics',
);

export const getAttemptAnalyticsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/analytics',
);

export const getAttemptAnalyticsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/analytics',
);

export const getAttemptAnalyticsBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/analytics',
);

export const getAttemptAnalyticsUnprocessableExample = {
  type: 'https://quizapp.com/errors/attempt-not-completed',
  title: 'Unprocessable Entity',
  status: 422,
  detail: 'Analytics are only available for completed attempts',
  instance: '/attempts/550e8400-e29b-71d4-a716-446655440099/analytics',
  code: 'ATTEMPT_NOT_COMPLETED',
};

export const getAttemptAnalyticsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/analytics',
);

// ─── GET /attempts/:attemptId/review ────────────────────────────────────────

export const getAttemptReviewNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/review',
);

export const getAttemptReviewForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/review',
);

export const getAttemptReviewUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/review',
);

export const getAttemptReviewBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/review',
);

export const getAttemptReviewUnprocessableExample = {
  type: 'https://quizapp.com/errors/attempt-not-completed',
  title: 'Unprocessable Entity',
  status: 422,
  detail: 'Review is only available for completed attempts',
  instance: '/attempts/550e8400-e29b-71d4-a716-446655440099/review',
  code: 'ATTEMPT_NOT_COMPLETED',
};

export const getAttemptReviewInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/attempts/550e8400-e29b-71d4-a716-446655440099/review',
);
