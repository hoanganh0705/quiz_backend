/**
 * Instance module Swagger decorators.
 *
 * Phase 4 of `docs/audits/INSTANCE_API_CONTRACT_AUDIT.md`.
 *
 * Provides:
 *   - `ApiInstanceIdParam()` — `:id` path parameter documented as
 *     `format: uuid` (matches runtime `ParseUUIDPipe` enforcement).
 *   - `InstanceErrorResponseExamples` — per-module RFC 7807 examples for
 *     every domain error class (replaces the generic
 *     `ErrorResponseExamples.notFound` / `.forbidden` shared entries that
 *     previously leaked unrelated `/quizzes/…` `instance` URIs).
 *
 * Used by the controller and the openapi-spec guard. Keeping these
 * constants in one place means audit-driven doc fixes only need to touch
 * this file (Phase 4 — issue 3.2).
 */
import { ApiParam } from '@nestjs/swagger';
import { RFC7807_TYPE_URIS } from '@/common/types/problem-detail.type';

const INSTANCE_NOT_FOUND_TYPE_URI = 'https://api.quiz.local/problems/instance-not-found';
const INSTANCE_NOT_HOST_TYPE_URI = 'https://api.quiz.local/problems/instance-not-host';
const INSTANCE_NOT_OPEN_TYPE_URI = 'https://api.quiz.local/problems/instance-not-open';
const INSTANCE_FULL_TYPE_URI = 'https://api.quiz.local/problems/instance-full';
const INSTANCE_ALREADY_STARTED_TYPE_URI =
  'https://api.quiz.local/problems/instance-already-started';
const INSTANCE_ALREADY_CLOSED_TYPE_URI = 'https://api.quiz.local/problems/instance-already-closed';
const PLAYER_ALREADY_JOINED_TYPE_URI = 'https://api.quiz.local/problems/player-already-joined';

/**
 * Documents the `:id` path parameter as `format: uuid` on every
 * instance-resource endpoint. Runtime `ParseUUIDPipe` enforces this at
 * the NestJS level; this decorator mirrors it in the OpenAPI spec so
 * generated SDK clients send UUIDs without custom regexes.
 */
export const ApiInstanceIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'id',
    description: 'UUID of the quiz instance',
    format: 'uuid',
  });

/**
 * Per-module RFC 7807 examples for instance domain errors.
 *
 * Phase 4 (audit issue 3.2) — replaces the shared `ErrorResponseExamples`
 * entries that previously surfaced generic `detail` strings
 * (`'The requested resource was not found'`) and unrelated
 * `instance` URIs (`/quizzes/...`). The runtime emits
 * `<INSTANCE_CODE>` ProblemDetail with these exact payloads.
 */
export const InstanceErrorResponseExamples = {
  instanceNotFound: {
    type: INSTANCE_NOT_FOUND_TYPE_URI,
    title: 'NotFound',
    status: 404,
    detail: 'Quiz instance not found',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000',
    extensions: { code: 'INSTANCE_NOT_FOUND', requestId: 'req_abc123' },
  },
  instanceNotHost: {
    type: INSTANCE_NOT_HOST_TYPE_URI,
    title: 'Forbidden',
    status: 403,
    detail: 'Only the host can perform this action',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_NOT_HOST', requestId: 'req_abc123' },
  },
  instanceNotOpen: {
    type: INSTANCE_NOT_OPEN_TYPE_URI,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance is not open for joining',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/join',
    extensions: { code: 'INSTANCE_NOT_OPEN', requestId: 'req_abc123' },
  },
  instanceFull: {
    type: INSTANCE_FULL_TYPE_URI,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance is full',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/join',
    extensions: { code: 'INSTANCE_FULL', requestId: 'req_abc123' },
  },
  instanceAlreadyStarted: {
    type: INSTANCE_ALREADY_STARTED_TYPE_URI,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance has already started',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_ALREADY_STARTED', requestId: 'req_abc123' },
  },
  instanceAlreadyClosed: {
    type: INSTANCE_ALREADY_CLOSED_TYPE_URI,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance is already closed',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_ALREADY_CLOSED', requestId: 'req_abc123' },
  },
  playerAlreadyJoined: {
    type: PLAYER_ALREADY_JOINED_TYPE_URI,
    title: 'Conflict',
    status: 409,
    detail: 'You have already joined this instance',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/join',
    extensions: { code: 'PLAYER_ALREADY_JOINED', requestId: 'req_abc123' },
  },
} as const;

// Re-export the canonical RFC 7807 type URIs so callers don't need a
// second import.
export const INSTANCE_TYPE_URIS = {
  400: RFC7807_TYPE_URIS[400],
  403: RFC7807_TYPE_URIS[403],
  404: RFC7807_TYPE_URIS[404],
  409: RFC7807_TYPE_URIS[409],
} as const;
