import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

/**
 * Category module error examples with endpoint-correct `instance` paths.
 *
 * Each category endpoint's documented 4xx/5xx responses use the example
 * returned by the matching factory below, so the spec mirrors the URL
 * the client actually requested.
 */

const withInstance = (
  base: (typeof ErrorResponseExamples)[keyof typeof ErrorResponseExamples],
  instance: string,
): Record<string, unknown> => ({ ...base, instance });

// ─── /categories/popular ────────────────────────────────────────────────────────

export const popularBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/popular',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: ['limit must be a positive integer'],
    requestId: 'req_abc123',
  },
};
export const popularInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/popular',
);

// ─── /categories/trending ───────────────────────────────────────────────────────

export const trendingBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/trending',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: ['limit must be a positive integer'],
    requestId: 'req_abc123',
  },
};
export const trendingInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/trending',
);

// ─── /categories/:slug/quizzes ────────────────────────────────────────────────

export const categoryQuizzesNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/general-knowledge/quizzes',
  ),
  detail: 'Category with slug "general-knowledge" not found or has been deleted',
};
export const categoryQuizzesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/general-knowledge/quizzes',
);

// ─── /categories/:slug/related ────────────────────────────────────────────────

export const relatedBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/general-knowledge/related',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: ['limit must be a positive integer'],
    requestId: 'req_abc123',
  },
};
export const relatedNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/general-knowledge/related',
  ),
  detail: 'Category with slug "general-knowledge" not found or has been deleted',
};
export const relatedInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/general-knowledge/related',
);

// ─── /categories/:id/analytics ─────────────────────────────────────────────────

export const analyticsBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/660e8400-e29b-41d4-a716-446655440000/analytics',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const analyticsNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000/analytics',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found or has been deleted',
};
export const analyticsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000/analytics',
);

// ─── /categories/:id/follow (POST) ──────────────────────────────────────────

export const followUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);
export const followForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);
export const followNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found or has been deleted',
};
export const followInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);
export const followBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const followTooManyRequestsExample = withInstance(
  ErrorResponseExamples.tooManyRequests,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);

// ─── /categories/:id/follow (DELETE) ───────────────────────────────────────────

export const unfollowUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found or has been deleted',
};
export const unfollowInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const unfollowTooManyRequestsExample = withInstance(
  ErrorResponseExamples.tooManyRequests,
  '/categories/660e8400-e29b-41d4-a716-446655440000/follow',
);

// ─── /categories/:id/restore ──────────────────────────────────────────────────

export const restoreUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/categories/660e8400-e29b-41d4-a716-446655440000/restore',
);
export const restoreForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/categories/660e8400-e29b-41d4-a716-446655440000/restore',
);
export const restoreNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000/restore',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found',
};
export const restoreConflictExample = {
  ...withInstance(
    ErrorResponseExamples.conflict,
    '/categories/660e8400-e29b-41d4-a716-446655440000/restore',
  ),
  detail: 'Category is already active and cannot be restored',
};
export const restoreInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000/restore',
);

// ─── /categories (GET list) ────────────────────────────────────────────────────

export const listCategoriesBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: ['limit must be a positive integer', 'cursor must be a string'],
    requestId: 'req_abc123',
  },
};
export const listCategoriesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories',
);

// ─── /categories/:id (GET by id) ──────────────────────────────────────────────

export const categoryByIdNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found or has been deleted',
};
export const categoryByIdBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/660e8400-e29b-41d4-a716-446655440000',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const categoryByIdInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);

// ─── /categories/:slug (GET by slug) ───────────────────────────────────────────

export const categoryBySlugNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/general-knowledge',
  ),
  detail: 'Category with slug "general-knowledge" not found or has been deleted',
};
export const categoryBySlugInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/general-knowledge',
);

// ─── /categories (POST create) ─────────────────────────────────────────────────

export const createCategoryBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: [
      'name must be a string',
      'slug must be a string',
      'slug must contain only lowercase letters, numbers, and hyphens',
    ],
    requestId: 'req_abc123',
  },
};
export const createCategoryUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/categories',
);
export const createCategoryForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/categories',
);
export const createCategoryConflictExample = {
  ...withInstance(
    ErrorResponseExamples.conflict,
    '/categories',
  ),
  detail: 'Category with slug "general-knowledge" already exists',
};
export const createCategoryInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories',
);

// ─── /categories/:id (PATCH update) ─────────────────────────────────────────────

export const updateCategoryBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/categories/660e8400-e29b-41d4-a716-446655440000',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: ['name must be a string', 'slug must be a string'],
    requestId: 'req_abc123',
  },
};
export const updateCategoryUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);
export const updateCategoryForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);
export const updateCategoryNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found or has been deleted',
};
export const updateCategoryConflictExample = {
  ...withInstance(
    ErrorResponseExamples.conflict,
    '/categories/660e8400-e29b-41d4-a716-446655440000',
  ),
  detail: 'Category with slug "general-knowledge" already exists',
};
export const updateCategoryInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);

// ─── /categories/:id (DELETE) ─────────────────────────────────────────────────

export const deleteCategoryUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);
export const deleteCategoryForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);
export const deleteCategoryNotFoundExample = {
  ...withInstance(
    ErrorResponseExamples.notFound,
    '/categories/660e8400-e29b-41d4-a716-446655440000',
  ),
  detail: 'Category with ID "660e8400-e29b-41d4-a716-446655440000" not found or has been deleted',
};
export const deleteCategoryInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/categories/660e8400-e29b-41d4-a716-446655440000',
);

// ─── /users/me/followed-categories ───────────────────────────────────────────

export const followedCategoriesBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/users/me/followed-categories',
  ),
  detail: 'Request validation failed',
  extensions: {
    errors: ['cursor must be a string', 'limit must be a positive integer'],
    requestId: 'req_abc123',
  },
};
export const followedCategoriesUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/users/me/followed-categories',
);
export const followedCategoriesForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/users/me/followed-categories',
);
export const followedCategoriesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/users/me/followed-categories',
);
