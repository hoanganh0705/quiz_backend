/**
 * Discussion module error-response examples.
 *
 * Each example is a ProblemDetail object (RFC 7807) that matches the
 * wire shape emitted by `GlobalExceptionFilter`. Examples are referenced
 * by `discussion-swagger-decorators.ts` and use the `instance` path of
 * the endpoint they are attached to.
 */

import { RFC7807_TYPE_URIS } from '@/common/types/problem-detail.type';

const REQUEST_ID = 'req_abc123';

// ─── Generic helpers ─────────────────────────────────────────────────────────

const withInstance = (
  base: (typeof EXAMPLE_BY_STATUS)[keyof typeof EXAMPLE_BY_STATUS],
  instance: string,
  detail?: string,
  errors?: string[],
): Record<string, unknown> => ({
  ...base,
  instance,
  detail: detail ?? base.detail,
  extensions: {
    ...(base.extensions as Record<string, unknown>),
    ...(errors ? { errors } : {}),
  },
});

const EXAMPLE_BY_STATUS = {
  badRequest: {
    type: RFC7807_TYPE_URIS[400],
    title: 'BadRequest',
    status: 400,
    detail: 'Request validation failed',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID },
  },
  unauthorized: {
    type: RFC7807_TYPE_URIS[401],
    title: 'Unauthorized',
    status: 401,
    detail: 'Invalid or expired access token',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID },
  },
  forbidden: {
    type: RFC7807_TYPE_URIS[403],
    title: 'Forbidden',
    status: 403,
    detail: 'You do not have permission to perform this action',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_FORBIDDEN' },
  },
  notFound: {
    type: RFC7807_TYPE_URIS[404],
    title: 'NotFound',
    status: 404,
    detail: 'The requested resource was not found',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
  },
  conflict: {
    type: RFC7807_TYPE_URIS[409],
    title: 'Conflict',
    status: 409,
    detail: 'The request conflicts with the current state of the resource',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID },
  },
  tooManyRequests: {
    type: RFC7807_TYPE_URIS[429],
    title: 'TooManyRequests',
    status: 429,
    detail: 'Rate limit exceeded. Please try again later',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID, retryAfter: 60 },
  },
  internalServerError: {
    type: RFC7807_TYPE_URIS[500],
    title: 'InternalServerError',
    status: 500,
    detail: 'An unexpected error occurred',
    instance: '/api/v1/endpoint',
    extensions: { requestId: REQUEST_ID },
  },
} as const;

// ─── GET /quizzes/:quizId/comments ───────────────────────────────────────────

export const listQuizCommentsBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  undefined,
  ['limit must not be greater than 100'],
);

export const listQuizCommentsInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
);

// ─── POST /quizzes/:quizId/comments ───────────────────────────────────────────

export const createCommentUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
);

export const createCommentBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  undefined,
  ['body must be longer than 1 character'],
);

export const createCommentParentCrossThreadExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail:
    'The selected parent comment is not a top-level comment on this quiz',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_PARENT_COMMENT_CROSS_THREAD' },
};

export const createCommentQuizNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Quiz not found: 660e8400-e29b-71d4-a716-446655440000',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_QUIZ_NOT_FOUND' },
};

export const createCommentParentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Parent comment not found: 880e8400-e29b-71d4-a716-446655440099',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_PARENT_COMMENT_NOT_FOUND' },
};

export const createCommentReplyLimitExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'Maximum reply limit of 100 reached for this comment',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_REPLY_LIMIT_EXCEEDED' },
};

export const createCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
);

// ─── GET /comments/:commentId ─────────────────────────────────────────────────

export const getCommentBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/comments/not-a-uuid',
  'Validation failed (uuid is expected)',
  ['commentId must be a UUID'],
);

export const getCommentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440000',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440000',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const getCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/comments/880e8400-e29b-71d4-a716-446655440000',
);

// ─── PATCH /comments/:commentId ───────────────────────────────────────────────

export const editCommentUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/comments/880e8400-e29b-71d4-a716-446655440001',
);

export const editCommentBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/comments/880e8400-e29b-71d4-a716-446655440001',
  undefined,
  ['body must be longer than 1 character'],
);

export const editCommentForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You do not have permission to perform this action on this comment',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_FORBIDDEN' },
};

export const editCommentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const editCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/comments/880e8400-e29b-71d4-a716-446655440001',
);

// ─── DELETE /comments/:commentId ──────────────────────────────────────────────

export const deleteCommentUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/comments/880e8400-e29b-71d4-a716-446655440001',
);

export const deleteCommentForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You do not have permission to perform this action on this comment',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_FORBIDDEN' },
};

export const deleteCommentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const deleteCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/comments/880e8400-e29b-71d4-a716-446655440001',
);

// ─── PUT /comments/:commentId/vote ────────────────────────────────────────────

export const voteUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
);

export const voteSelfVoteExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You cannot vote on your own comment',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_SELF_VOTE' },
};

export const voteBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
  undefined,
  ['value must be one of: upvote, downvote'],
);

export const voteNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const voteInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
);

// ─── DELETE /comments/:commentId/vote ─────────────────────────────────────────

export const removeVoteUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
);

export const removeVoteBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
  'Validation failed (uuid is expected)',
  ['commentId must be a UUID'],
);

export const removeVoteNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const removeVoteInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/comments/880e8400-e29b-71d4-a716-446655440001/vote',
);

// ─── POST /comments/:commentId/reports ───────────────────────────────────────

export const reportCommentUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
);

export const reportCommentBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
  undefined,
  ['reason must be longer than 1 character'],
);

export const reportCommentSelfReportExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You cannot report your own comment',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_SELF_REPORT' },
};

export const reportCommentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const reportCommentDuplicateExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'You have already reported this comment',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_DUPLICATE_REPORT' },
};

export const reportCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
);

export const reportCommentTooManyRequestsExample = {
  type: RFC7807_TYPE_URIS[429],
  title: 'TooManyRequests',
  status: 429,
  detail: 'Rate limit exceeded. Please try again later',
  instance: '/comments/880e8400-e29b-71d4-a716-446655440001/reports',
  extensions: { requestId: REQUEST_ID, retryAfter: 60 },
};

export const createCommentTooManyRequestsExample = {
  type: RFC7807_TYPE_URIS[429],
  title: 'TooManyRequests',
  status: 429,
  detail: 'Rate limit exceeded. Please try again later',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/comments',
  extensions: { requestId: REQUEST_ID, retryAfter: 60 },
};

// ─── POST /comments/:commentId/hide  &  POST /comments/:commentId/restore ───

const moderatorHideInstance = '/comments/880e8400-e29b-71d4-a716-446655440001/hide';

export const hideCommentUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  moderatorHideInstance,
);

export const hideCommentModeratorRequiredExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'Moderator or admin role is required to perform this action',
  instance: moderatorHideInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_MODERATOR_REQUIRED' },
};

export const hideCommentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: moderatorHideInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const hideCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  moderatorHideInstance,
);

const moderatorRestoreInstance = '/comments/880e8400-e29b-71d4-a716-446655440001/restore';

export const restoreCommentUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  moderatorRestoreInstance,
);

export const restoreCommentModeratorRequiredExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'Moderator or admin role is required to perform this action',
  instance: moderatorRestoreInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_MODERATOR_REQUIRED' },
};

export const restoreCommentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Comment not found: 880e8400-e29b-71d4-a716-446655440001',
  instance: moderatorRestoreInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_COMMENT_NOT_FOUND' },
};

export const restoreCommentInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  moderatorRestoreInstance,
);

// ─── GET /comments/reports ────────────────────────────────────────────────────

const listReportsInstance = '/comments/reports';

export const listReportsUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  listReportsInstance,
);

export const listReportsForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'Moderator or admin role is required to perform this action',
  instance: listReportsInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_MODERATOR_REQUIRED' },
};

export const listReportsBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  listReportsInstance,
  undefined,
  ['status must be one of: open, reviewed, dismissed, actioned'],
);

export const listReportsInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  listReportsInstance,
);

// ─── POST /comments/reports/:reportId/review ──────────────────────────────────

const reviewInstance = '/comments/reports/990e8400-e29b-71d4-a716-446655440000/review';

export const reviewReportUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  reviewInstance,
);

export const reviewReportForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'Moderator or admin role is required to perform this action',
  instance: reviewInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_MODERATOR_REQUIRED' },
};

export const reviewReportBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  reviewInstance,
  undefined,
  ['status must be one of: reviewed, dismissed, actioned'],
);

export const reviewReportNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Report not found: 990e8400-e29b-71d4-a716-446655440000',
  instance: reviewInstance,
  extensions: { requestId: REQUEST_ID, code: 'DISCUSSION_REPORT_NOT_FOUND' },
};

export const reviewReportInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  reviewInstance,
);

// ─── GET /users/me/comments ──────────────────────────────────────────────────

export const listMyCommentsUnauthorizedExample = withInstance(
  EXAMPLE_BY_STATUS.unauthorized,
  '/users/me/comments',
);

export const listMyCommentsBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/users/me/comments',
  undefined,
  ['limit must not be greater than 100'],
);

export const listMyCommentsInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/users/me/comments',
);

// ─── GET /users/:userId/comments ─────────────────────────────────────────────

export const listUserCommentsBadRequestExample = withInstance(
  EXAMPLE_BY_STATUS.badRequest,
  '/users/550e8400-e29b-71d4-a716-446655440000/comments',
  undefined,
  ['limit must not be greater than 100'],
);

export const listUserCommentsInternalErrorExample = withInstance(
  EXAMPLE_BY_STATUS.internalServerError,
  '/users/550e8400-e29b-71d4-a716-446655440000/comments',
);
