/**
 * Tournament module error-response examples.
 *
 * Each example is a ProblemDetail object (RFC 7807) that matches the
 * wire shape emitted by `GlobalExceptionFilter`. These are referenced
 * by `tournament-swagger-decorators.ts`.
 */

import { RFC7807_TYPE_URIS } from '@/common/types/problem-detail.type';

// ─── 400 Bad Request ────────────────────────────────────────────────────

const BAD_REQUEST_DETAIL = 'Request validation failed';
const REQUEST_ID = 'req_abc123';

export const tournamentBadRequestExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: BAD_REQUEST_DETAIL,
  instance: '/api/v1/tournaments',
  extensions: {
    errors: ['endAt must be after startAt'],
    requestId: REQUEST_ID,
  },
} as const;

export const tournamentValidationExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'endAt must be after startAt',
  instance: '/api/v1/tournaments',
  extensions: {
    requestId: REQUEST_ID,
  },
} as const;

export const tournamentRegistrationClosedExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'Tournament registration is closed',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: {
    requestId: REQUEST_ID,
  },
} as const;

export const tournamentFullExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'Tournament is full',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: {
    requestId: REQUEST_ID,
  },
} as const;

export const tournamentRoundNotOpenExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'Tournament round is not open',
  instance:
    '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/rounds/880e8400-e29b-71d4-a716-446655440001/attempts',
  extensions: {
    requestId: REQUEST_ID,
  },
} as const;

export const tournamentUnregisterClosedExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'Tournament unregistration is only allowed during the registration phase',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: {
    requestId: REQUEST_ID,
  },
} as const;

export const tournamentWithdrawClosedExample = {
  type: RFC7807_TYPE_URIS[400],
  title: 'BadRequest',
  status: 400,
  detail: 'Tournament withdrawal is only allowed while the tournament is active',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/withdraw',
  extensions: {
    requestId: REQUEST_ID,
  },
} as const;

// ─── 401 Unauthorized ──────────────────────────────────────────────────

export const tournamentUnauthorizedExample = {
  type: RFC7807_TYPE_URIS[401],
  title: 'Unauthorized',
  status: 401,
  detail: 'Authorization header is missing',
  instance: '/api/v1/tournaments',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 403 Forbidden ─────────────────────────────────────────────────────

export const tournamentForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You do not have permission to manage this tournament',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: { requestId: REQUEST_ID },
} as const;

export const tournamentParticipantForbiddenExample = {
  type: RFC7807_TYPE_URIS[403],
  title: 'Forbidden',
  status: 403,
  detail: 'You do not have permission to manage this tournament',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/withdraw',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 404 Not Found ─────────────────────────────────────────────────────

export const tournamentNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Tournament not found',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000',
  extensions: { requestId: REQUEST_ID },
} as const;

export const tournamentRoundNotFoundExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'Tournament round not found',
  instance:
    '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/rounds/880e8400-e29b-71d4-a716-446655440001/attempts',
  extensions: { requestId: REQUEST_ID },
} as const;

export const tournamentNotRegisteredExample = {
  type: RFC7807_TYPE_URIS[404],
  title: 'NotFound',
  status: 404,
  detail: 'You are not registered for this tournament',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: { requestId: REQUEST_ID },
} as const;

// ─── 409 Conflict ─────────────────────────────────────────────────────

export const tournamentAlreadyRegisteredExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'You are already registered for this tournament',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: { requestId: REQUEST_ID },
} as const;

export const tournamentAttemptAlreadyExistsExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'You have already submitted an attempt for this round',
  instance:
    '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/rounds/880e8400-e29b-71d4-a716-446655440001/attempts',
  extensions: { requestId: REQUEST_ID },
} as const;

export const tournamentParticipantStateExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'Invalid participant state for this operation',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/register',
  extensions: { requestId: REQUEST_ID },
} as const;

export const tournamentAlreadyWithdrawnExample = {
  type: RFC7807_TYPE_URIS[409],
  title: 'Conflict',
  status: 409,
  detail: 'You have already withdrawn from this tournament',
  instance: '/api/v1/tournaments/660e8400-e29b-71d4-a716-446655440000/withdraw',
  extensions: { requestId: REQUEST_ID },
} as const;
