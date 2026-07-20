/**
 * Review module error-response examples.
 *
 * Each example is a ProblemDetail object (RFC 7807) that matches the
 * wire shape emitted by `GlobalExceptionFilter`. These are referenced
 * by `review-swagger-decorators.ts`.
 */

import { RFC7807_TYPE_URIS } from '@/common/types/problem-detail.type';

// ─── 400 Bad Request ────────────────────────────────────────────────────

const BAD_REQUEST_DETAIL = 'Request validation failed';
const REQUEST_ID = 'req_abc123';

export const reviewBadRequestExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: BAD_REQUEST_DETAIL,
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/reviews',
  extensions: {
    errors: ['rating must not be greater than 5'],
    requestId: REQUEST_ID,
  },
} as const;

// ─── 401 Unauthorized ──────────────────────────────────────────────────

export const reviewUnauthorizedExample = {
  type: RFC7807_TYPE_URIS[401],
  title: 'Unauthorized',
  status: 401,
  detail: 'Invalid or expired access token',
  instance: '/reviews/me',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 403 Forbidden ─────────────────────────────────────────────────────

export const reviewForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You do not have permission to manage this review',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/reviews',
  extensions: { requestId: REQUEST_ID },
} as const;

export const reviewForbiddenAnalyticsExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You do not have permission to view analytics for this quiz',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/reviews/analytics',
  extensions: { requestId: REQUEST_ID },
} as const;

export const reviewForbiddenPermissionExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'Authenticated user lacks the REVIEW_MODERATE permission',
  instance: '/admin/reviews/reports',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 404 Not Found ─────────────────────────────────────────────────────

export const reviewNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Review not found',
  instance: '/reviews/550e8400-e29b-71d4-a716-446655440099',
  extensions: { requestId: REQUEST_ID },
} as const;

export const quizNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Quiz not found',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/reviews',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 409 Conflict ─────────────────────────────────────────────────────

export const reviewConflictExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'You have already reviewed this quiz',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/reviews',
  extensions: { requestId: REQUEST_ID },
} as const;

export const reviewAlreadyReportedExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'You have already reported this review',
  instance: '/reviews/550e8400-e29b-71d4-a716-446655440099/report',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 500 Internal Server Error ─────────────────────────────────────────

export const reviewInternalErrorExample = {
  type: RFC7807_TYPE_URIS[500],
  title: 'InternalServerError',
  status: 500,
  detail: 'An unexpected error occurred',
  instance: '/reviews/me',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── Domain-specific error examples ────────────────────────────────────

export const reviewAttemptRequiredExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'You must complete at least one attempt before reviewing this quiz',
  instance: '/quizzes/660e8400-e29b-71d4-a716-446655440000/reviews',
  extensions: { requestId: REQUEST_ID },
} as const;

export const reviewSelfVoteExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'You cannot vote on your own review',
  instance: '/reviews/550e8400-e29b-71d4-a716-446655440099/helpful',
  extensions: { requestId: REQUEST_ID },
} as const;

export const reviewSelfReportExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'You cannot report your own review',
  instance: '/reviews/550e8400-e29b-71d4-a716-446655440099/report',
  extensions: { requestId: REQUEST_ID },
} as const;
