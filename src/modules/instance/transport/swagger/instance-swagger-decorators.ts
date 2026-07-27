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
 * Type URIs are sourced from `ProblemCodeMapping`, ensuring the OpenAPI
 * examples stay in sync with the runtime type URI values (single source
 * of truth).
 */
import { ApiParam } from '@nestjs/swagger';
import { ProblemCodeMapping } from '@/common/errors/problem-code-mapping';

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
    type: ProblemCodeMapping.INSTANCE_NOT_FOUND.typeUri,
    title: 'NotFound',
    status: 404,
    detail: 'Quiz instance not found',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000',
    extensions: { code: 'INSTANCE_NOT_FOUND', requestId: 'req_abc123' },
  },
  instanceNotHost: {
    type: ProblemCodeMapping.INSTANCE_NOT_HOST.typeUri,
    title: 'Forbidden',
    status: 403,
    detail: 'Only the host can perform this action',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_NOT_HOST', requestId: 'req_abc123' },
  },
  instanceNotOpen: {
    type: ProblemCodeMapping.INSTANCE_NOT_OPEN.typeUri,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance is not open for joining',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/join',
    extensions: { code: 'INSTANCE_NOT_OPEN', requestId: 'req_abc123' },
  },
  instanceFull: {
    type: ProblemCodeMapping.INSTANCE_FULL.typeUri,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance is full',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/join',
    extensions: { code: 'INSTANCE_FULL', requestId: 'req_abc123' },
  },
  instanceAlreadyStarted: {
    type: ProblemCodeMapping.INSTANCE_ALREADY_STARTED.typeUri,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance has already started',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_ALREADY_STARTED', requestId: 'req_abc123' },
  },
  instanceAlreadyClosed: {
    type: ProblemCodeMapping.INSTANCE_ALREADY_CLOSED.typeUri,
    title: 'BadRequest',
    status: 400,
    detail: 'Instance is already closed',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_ALREADY_CLOSED', requestId: 'req_abc123' },
  },
  playerAlreadyJoined: {
    type: ProblemCodeMapping.PLAYER_ALREADY_JOINED.typeUri,
    title: 'Conflict',
    status: 409,
    detail: 'You have already joined this instance',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/join',
    extensions: { code: 'PLAYER_ALREADY_JOINED', requestId: 'req_abc123' },
  },
  minPlayersNotMet: {
    type: ProblemCodeMapping.MIN_PLAYERS_NOT_MET.typeUri,
    title: 'UnprocessableEntity',
    status: 422,
    detail: 'Instance requires at least 2 players before the host can start the countdown',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'MIN_PLAYERS_NOT_MET', requestId: 'req_abc123' },
  },
  instanceNotInCountdown: {
    type: ProblemCodeMapping.INSTANCE_NOT_IN_COUNTDOWN.typeUri,
    title: 'Conflict',
    status: 409,
    detail: 'Instance is not in the countdown state',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/start',
    extensions: { code: 'INSTANCE_NOT_IN_COUNTDOWN', requestId: 'req_abc123' },
  },
  instanceCountdownAlreadyStarted: {
    type: ProblemCodeMapping.INSTANCE_COUNTDOWN_ALREADY_STARTED.typeUri,
    title: 'Conflict',
    status: 409,
    detail: 'Countdown has already started for this instance',
    instance: '/api/v1/instances/660e8400-e29b-71d4-a716-446655440000/countdown',
    extensions: { code: 'INSTANCE_COUNTDOWN_ALREADY_STARTED', requestId: 'req_abc123' },
  },
} as const;
