import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

/**
 * Tag module error examples with endpoint-correct `instance` paths.
 *
 * Each Tag endpoint's documented 4xx/5xx responses should use the example
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

// ─── /tags/popular ──────────────────────────────────────────────────────────────

export const popularBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/tags/popular',
);
export const popularInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/popular',
);

// ─── /tags/trending ─────────────────────────────────────────────────────────────

export const trendingBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/tags/trending',
);
export const trendingInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/trending',
);

// ─── /tags/:slug/quizzes ────────────────────────────────────────────────────────

export const tagQuizzesNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/javascript/quizzes',
);
export const tagQuizzesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/javascript/quizzes',
);

// ─── /tags/:slug/related ────────────────────────────────────────────────────────

export const relatedBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/tags/javascript/related',
);
export const relatedNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/javascript/related',
);
export const relatedInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/javascript/related',
);

// ─── /tags/:id/analytics ────────────────────────────────────────────────────────

export const analyticsBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/tags/770e8400-e29b-41d4-a716-446655440000/analytics',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const analyticsNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/770e8400-e29b-41d4-a716-446655440000/analytics',
);
export const analyticsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/770e8400-e29b-41d4-a716-446655440000/analytics',
);

// ─── /tags/:id/follow (POST) ────────────────────────────────────────────────────

export const followUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const followForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const followNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const followTooManyRequestsExample = withInstance(
  ErrorResponseExamples.tooManyRequests,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const followBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const followInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);

// ─── /tags/:id/follow (DELETE) ──────────────────────────────────────────────────

export const unfollowUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowTooManyRequestsExample = withInstance(
  ErrorResponseExamples.tooManyRequests,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);
export const unfollowBadRequestExample = {
  ...withInstance(
    ErrorResponseExamples.badRequest,
    '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
  ),
  detail: 'Validation failed (uuid is expected)',
  extensions: { requestId: 'req_abc123' },
};
export const unfollowInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/770e8400-e29b-41d4-a716-446655440000/follow',
);

// ─── /tags/:id/restore ─────────────────────────────────────────────────────────

export const restoreUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/tags/770e8400-e29b-41d4-a716-446655440000/restore',
);
export const restoreForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/tags/770e8400-e29b-41d4-a716-446655440000/restore',
);
export const restoreNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/770e8400-e29b-41d4-a716-446655440000/restore',
);
export const restoreConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/tags/770e8400-e29b-41d4-a716-446655440000/restore',
);
export const restoreInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/770e8400-e29b-41d4-a716-446655440000/restore',
);

// ─── /tags (GET list) ───────────────────────────────────────────────────────────

export const listTagsBadRequestExample = withInstance(ErrorResponseExamples.badRequest, '/tags');
export const listTagsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags',
);

// ─── /tags/:slug (GET by slug) ──────────────────────────────────────────────────

export const tagBySlugNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/javascript',
);
export const tagBySlugInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/javascript',
);

// ─── /tags (POST create) ────────────────────────────────────────────────────────

export const createTagBadRequestExample = withInstance(ErrorResponseExamples.badRequest, '/tags');
export const createTagUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/tags',
);
export const createTagForbiddenExample = withInstance(ErrorResponseExamples.forbidden, '/tags');
export const createTagConflictExample = withInstance(ErrorResponseExamples.conflict, '/tags');
export const createTagInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags',
);

// ─── /tags/:id (PATCH update) ───────────────────────────────────────────────────

export const updateTagBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const updateTagUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const updateTagForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const updateTagNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const updateTagConflictExample = withInstance(
  ErrorResponseExamples.conflict,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const updateTagInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);

// ─── /tags/:id (DELETE) ─────────────────────────────────────────────────────────

export const deleteTagUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const deleteTagForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const deleteTagNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);
export const deleteTagInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/tags/770e8400-e29b-41d4-a716-446655440000',
);

// ─── /users/me/followed-tags ────────────────────────────────────────────────────

export const followedTagsBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/users/me/followed-tags',
);
export const followedTagsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/users/me/followed-tags',
);
export const followedTagsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/users/me/followed-tags',
);
export const followedTagsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/users/me/followed-tags',
);
