import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

/**
 * Bookmark module error examples with endpoint-correct `instance` paths.
 *
 * Each bookmark endpoint's documented 4xx/5xx responses should use the example
 * returned by the matching factory below, so the spec mirrors the URL the
 * client actually requested.
 *
 * The example bodies mirror the global `ErrorResponseExamples` shape
 * (`type`, `title`, `status`, `detail`, `instance`, `extensions`) but
 * override `instance` to point at the request path.
 */

const withInstance = (
  base: (typeof ErrorResponseExamples)[keyof typeof ErrorResponseExamples],
  instance: string,
): Record<string, unknown> => ({ ...base, instance });

const SAMPLE_COLLECTION_ID = '770e8400-e29b-41d4-a716-446655440000';
const SAMPLE_QUIZ_ID = '660e8400-e29b-41d4-a716-446655440000';
const COLLECTION_PATH = `/api/v1/bookmarks/collections/${SAMPLE_COLLECTION_ID}`;
const QUIZ_PATH = `/api/v1/bookmarks/collections/${SAMPLE_COLLECTION_ID}/quizzes/${SAMPLE_QUIZ_ID}`;

// ─── GET /bookmarks/search ──────────────────────────────────────────────────

export const searchBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/api/v1/bookmarks/search',
);
export const searchUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/bookmarks/search',
);
export const searchInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/bookmarks/search',
);

// ─── GET /bookmarks/recent ───────────────────────────────────────────────────

export const recentBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/api/v1/bookmarks/recent',
);
export const recentUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/bookmarks/recent',
);
export const recentInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/bookmarks/recent',
);

// ─── GET /bookmarks/quizzes/:quizId/status ──────────────────────────────────

export const statusBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, QUIZ_PATH),
  detail: 'Validation failed (uuid is expected)',
};
export const statusUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  QUIZ_PATH,
);
export const statusInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  QUIZ_PATH,
);

// ─── GET /bookmarks/collections ─────────────────────────────────────────────

export const listCollectionsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/bookmarks/collections',
);
export const listCollectionsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/bookmarks/collections',
);

// ─── POST /bookmarks/collections ────────────────────────────────────────────

export const createCollectionBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/api/v1/bookmarks/collections',
);
export const createCollectionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/bookmarks/collections',
);
export const createCollectionConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/api/v1/bookmarks/collections',
);
export const createCollectionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/bookmarks/collections',
);

// ─── GET /bookmarks/collections/:collectionId ───────────────────────────────

export const collectionBookmarksBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, COLLECTION_PATH),
  detail: 'Validation failed (uuid is expected)',
};
export const collectionBookmarksUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  COLLECTION_PATH,
);
export const collectionBookmarksNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  COLLECTION_PATH,
);
export const collectionBookmarksForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  COLLECTION_PATH,
);
export const collectionBookmarksInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  COLLECTION_PATH,
);

// ─── GET /bookmarks/collections/:collectionId/analytics ─────────────────────

export const analyticsBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `${COLLECTION_PATH}/analytics`),
  detail: 'Validation failed (uuid is expected)',
};
export const analyticsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `${COLLECTION_PATH}/analytics`,
);
export const analyticsNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `${COLLECTION_PATH}/analytics`,
);
export const analyticsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `${COLLECTION_PATH}/analytics`,
);

// ─── POST /bookmarks/collections/:collectionId/quizzes ──────────────────────

export const addBookmarkBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `${COLLECTION_PATH}/quizzes`),
  detail: 'Validation failed (quizId must be a UUID)',
};
export const addBookmarkUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `${COLLECTION_PATH}/quizzes`,
);
export const addBookmarkForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `${COLLECTION_PATH}/quizzes`,
);
export const addBookmarkNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `${COLLECTION_PATH}/quizzes`,
);
export const addBookmarkConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `${COLLECTION_PATH}/quizzes`,
);
export const addBookmarkInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `${COLLECTION_PATH}/quizzes`,
);

// ─── POST /bookmarks/collections/:collectionId/quizzes/bulk ─────────────────

export const bulkAddBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `${COLLECTION_PATH}/quizzes/bulk`),
  detail: 'Validation failed (each quizIds must be a UUID)',
};
export const bulkAddUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `${COLLECTION_PATH}/quizzes/bulk`,
);
export const bulkAddForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `${COLLECTION_PATH}/quizzes/bulk`,
);
export const bulkAddNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `${COLLECTION_PATH}/quizzes/bulk`,
);
export const bulkAddInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `${COLLECTION_PATH}/quizzes/bulk`,
);

// ─── DELETE /bookmarks/collections/:collectionId/quizzes/bulk ──────────────

export const bulkRemoveBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `${COLLECTION_PATH}/quizzes/bulk`),
  detail: 'Validation failed (each quizIds must be a UUID)',
};
export const bulkRemoveUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `${COLLECTION_PATH}/quizzes/bulk`,
);
export const bulkRemoveForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `${COLLECTION_PATH}/quizzes/bulk`,
);
export const bulkRemoveNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `${COLLECTION_PATH}/quizzes/bulk`,
);
export const bulkRemoveInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `${COLLECTION_PATH}/quizzes/bulk`,
);

// ─── DELETE /bookmarks/collections/:collectionId/quizzes/:quizId ───────────

export const removeBookmarkBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, QUIZ_PATH),
  detail: 'Validation failed (uuid is expected)',
};
export const removeBookmarkUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  QUIZ_PATH,
);
export const removeBookmarkNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  QUIZ_PATH,
);
export const removeBookmarkInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  QUIZ_PATH,
);

// ─── PATCH /bookmarks/collections/:collectionId/quizzes/:quizId ────────────

export const updateBookmarkBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, QUIZ_PATH),
  detail: 'notes must be shorter than or equal to 500 characters',
};
export const updateBookmarkUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  QUIZ_PATH,
);
export const updateBookmarkForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  QUIZ_PATH,
);
export const updateBookmarkNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  QUIZ_PATH,
);
export const updateBookmarkInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  QUIZ_PATH,
);

// ─── POST /bookmarks/collections/:collectionId/move ─────────────────────────

export const moveBookmarkBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, `${COLLECTION_PATH}/move`),
  detail: 'Validation failed (targetCollectionId must be a UUID)',
};
export const moveBookmarkUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `${COLLECTION_PATH}/move`,
);
export const moveBookmarkForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `${COLLECTION_PATH}/move`,
);
export const moveBookmarkNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `${COLLECTION_PATH}/move`,
);
export const moveBookmarkConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  `${COLLECTION_PATH}/move`,
);
export const moveBookmarkInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `${COLLECTION_PATH}/move`,
);

// ─── PATCH /bookmarks/collections/:collectionId ─────────────────────────────

export const updateCollectionBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  COLLECTION_PATH,
);
export const updateCollectionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  COLLECTION_PATH,
);
export const updateCollectionForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  COLLECTION_PATH,
);
export const updateCollectionNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  COLLECTION_PATH,
);
export const updateCollectionConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  COLLECTION_PATH,
);
export const updateCollectionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  COLLECTION_PATH,
);

// ─── DELETE /bookmarks/collections/:collectionId ─────────────────────────────

export const deleteCollectionBadRequestExample = {
  ...withInstance(ErrorResponseExamples.badRequest, COLLECTION_PATH),
  detail: 'Validation failed (uuid is expected)',
};
export const deleteCollectionUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  COLLECTION_PATH,
);
export const deleteCollectionForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  COLLECTION_PATH,
);
export const deleteCollectionNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  COLLECTION_PATH,
);
export const deleteCollectionInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  COLLECTION_PATH,
);

// ─── GET /bookmarks/me/stats ────────────────────────────────────────────────

export const statsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/bookmarks/me/stats',
);
export const statsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/bookmarks/me/stats',
);
