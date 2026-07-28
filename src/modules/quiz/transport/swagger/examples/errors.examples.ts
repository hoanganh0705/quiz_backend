import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { RFC7807_TYPE_URIS } from '@/common/types/problem-detail.type';
import { QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE } from '../../../quiz.constants';

/**
 * Quiz module error examples with endpoint-correct `instance` paths.
 *
 * Every documented 4xx/5xx response uses the example returned by the matching
 * factory below, so the spec mirrors the URL the client actually requested.
 */

const withInstance = (
  base: (typeof ErrorResponseExamples)[keyof typeof ErrorResponseExamples],
  instance: string,
): Record<string, unknown> => ({ ...base, instance });

const UUID_BAD_REQUEST_DETAIL = 'Validation failed (uuid is expected)';
const UUID_ID = '660e8400-e29b-71d4-a716-446655440000';
const UUID_VERSION_ID = '550e8400-e29b-71d4-a716-446655440000';

// ─── POST /quizzes ────────────────────────────────────────────────────────────

export const createQuizBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes',
);
export const createQuizUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/quizzes',
);
export const createQuizForbiddenExample = withInstance(ErrorResponseExamples.forbidden, '/quizzes');
export const createQuizConflictExample = withInstance(ErrorResponseExamples.conflict, '/quizzes');
export const createQuizInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes',
);

// ─── GET /quizzes ─────────────────────────────────────────────────────────────

export const listQuizzesBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes',
);
export const listQuizzesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes',
);

// ─── GET /quizzes/me ──────────────────────────────────────────────────────────

export const meQuizzesUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/quizzes/me',
);
export const meQuizzesForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/quizzes/me',
);
export const meQuizzesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/me',
);

// ─── GET /quizzes/me/drafts ───────────────────────────────────────────────────

export const meDraftsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/quizzes/me/drafts',
);
export const meDraftsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/quizzes/me/drafts',
);
export const meDraftsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/me/drafts',
);

// ─── GET /quizzes/me/published ────────────────────────────────────────────────

export const mePublishedUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/quizzes/me/published',
);
export const mePublishedForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/quizzes/me/published',
);
export const mePublishedInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/me/published',
);

// ─── GET /quizzes/me/analytics ────────────────────────────────────────────────

export const meAnalyticsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/quizzes/me/analytics',
);
export const meAnalyticsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/quizzes/me/analytics',
);
export const meAnalyticsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/me/analytics',
);

// ─── GET /quizzes/trending ────────────────────────────────────────────────────

export const trendingBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes/trending',
);
export const trendingInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/trending',
);

// ─── GET /quizzes/popular ─────────────────────────────────────────────────────

export const popularBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes/popular',
);
export const popularInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/popular',
);

// ─── GET /quizzes/featured ────────────────────────────────────────────────────

export const featuredBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes/featured',
);
export const featuredInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/featured',
);

// ─── GET /quizzes/:id (also matches /quizzes/:slug) ───────────────────────────

export const quizByIdBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `/quizzes/${UUID_ID}`),
  detail: UUID_BAD_REQUEST_DETAIL,
  extensions: { requestId: 'req_abc123' },
};
export const quizByIdNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}`,
);
export const quizByIdInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}`,
);

// ─── GET /quizzes/:id/stats ───────────────────────────────────────────────────

const ID_OR_SLUG_BAD_REQUEST_DETAIL = 'Path param must be a UUID or a kebab-case slug';

export const quizStatsBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `/quizzes/${UUID_ID}/stats`),
  detail: ID_OR_SLUG_BAD_REQUEST_DETAIL,
  extensions: { requestId: 'req_abc123' },
};
export const quizStatsNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/stats`,
);
export const quizStatsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/stats`,
);

// ─── GET /quizzes/:slug/related ───────────────────────────────────────────────

export const relatedQuizzesBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/quizzes/javascript-fundamentals/related',
);
export const relatedQuizzesNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/quizzes/javascript-fundamentals/related',
);
export const relatedQuizzesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/quizzes/javascript-fundamentals/related',
);

// ─── PATCH /quizzes/:id ──────────────────────────────────────────────────────

export const updateQuizBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  `/quizzes/${UUID_ID}`,
);
export const updateQuizUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}`,
);
export const updateQuizForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}`,
);
export const updateQuizNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}`,
);
export const updateQuizConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `/quizzes/${UUID_ID}`,
);
export const updateQuizInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}`,
);

// ─── DELETE /quizzes/:id ─────────────────────────────────────────────────────

export const deleteQuizBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `/quizzes/${UUID_ID}`),
  detail: UUID_BAD_REQUEST_DETAIL,
  extensions: { requestId: 'req_abc123' },
};
export const deleteQuizUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}`,
);
export const deleteQuizForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}`,
);
export const deleteQuizNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}`,
);
export const deleteQuizInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}`,
);

// ─── POST /quizzes/:id/versions ──────────────────────────────────────────────

export const createQuizVersionBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  `/quizzes/${UUID_ID}/versions`,
);
export const createQuizVersionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions`,
);
export const createQuizVersionForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions`,
);
export const createQuizVersionNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions`,
);
export const createQuizVersionConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `/quizzes/${UUID_ID}/versions`,
);
export const createQuizVersionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions`,
);

// ─── GET /quizzes/:id/versions ───────────────────────────────────────────────

export const listQuizVersionsBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `/quizzes/${UUID_ID}/versions`),
  detail: UUID_BAD_REQUEST_DETAIL,
  extensions: { requestId: 'req_abc123' },
};
export const listQuizVersionsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions`,
);
export const listQuizVersionsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions`,
);
export const listQuizVersionsNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions`,
);
export const listQuizVersionsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions`,
);

// ─── GET /quizzes/:id/versions/:versionId ────────────────────────────────────

export const getQuizVersionDetailBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
  ),
  detail: UUID_BAD_REQUEST_DETAIL,
  extensions: { requestId: 'req_abc123' },
};
export const getQuizVersionDetailUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const getQuizVersionDetailForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const getQuizVersionDetailNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const getQuizVersionDetailInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);

// ─── PATCH /quizzes/:id/versions/:versionId ──────────────────────────────────

export const updateQuizVersionBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const updateQuizVersionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const updateQuizVersionForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const updateQuizVersionNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const updateQuizVersionConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);
export const updateQuizVersionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}`,
);

// ─── POST /quizzes/:id/versions/:versionId/publish ───────────────────────────

export const publishQuizVersionBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/publish`,
);
export const publishQuizVersionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/publish`,
);
export const publishQuizVersionForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/publish`,
);
export const publishQuizVersionNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/publish`,
);
export const publishQuizVersionUnprocessableExample = {
  type: RFC7807_TYPE_URIS[422],
  title: 'UnprocessableEntity',
  status: 422,
  detail: QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE,
  instance: `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/publish`,
  extensions: { requestId: 'req_abc123' },
};
export const publishQuizVersionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/publish`,
);

// ─── POST /quizzes/:id/versions/:versionId/questions ─────────────────────────

export const createQuizQuestionBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions`,
);
export const createQuizQuestionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions`,
);
export const createQuizQuestionForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions`,
);
export const createQuizQuestionNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions`,
);
export const createQuizQuestionConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions`,
);
export const createQuizQuestionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions`,
);

// ─── POST /quizzes/:id/versions/:versionId/questions/bulk ───────────────────

export const createQuizQuestionsBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions/bulk`,
);
export const createQuizQuestionsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions/bulk`,
);
export const createQuizQuestionsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions/bulk`,
);
export const createQuizQuestionsNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions/bulk`,
);
export const createQuizQuestionsConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions/bulk`,
);
export const createQuizQuestionsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/quizzes/${UUID_ID}/versions/${UUID_VERSION_ID}/questions/bulk`,
);
