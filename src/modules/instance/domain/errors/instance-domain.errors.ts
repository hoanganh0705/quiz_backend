import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  INSTANCE_ALREADY_CLOSED_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  PLAYER_ALREADY_JOINED_MESSAGE,
} from '../../instance.constants';

/**
 * Instance-module namespace marker for instance-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, tournament, review, and bookmark modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new InstanceDomainError' src/` returns no matches.
 *
 * Special note: the instance module has TWO exception filters —
 * `InstanceDomainExceptionFilter` (HTTP, controller-scoped, deleted in
 * Phase 2) and `WsExceptionFilter` (WS gateway, KEPT — handles only
 * auth/generic, not domain errors). The instance controller is the
 * only place where the HTTP filter was wired.
 */
export abstract class InstanceDomainError extends BaseDomainException {}

/**
 * Thrown when a quiz instance cannot be found. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `InstanceNotFoundError.message` to a hardcoded generic
 * `'Resource not found'`. The global filter now preserves
 * `exception.message` (default: `'Quiz instance not found'`).
 */
export class InstanceNotFoundError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_FOUND';
  constructor(message = INSTANCE_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the authenticated user is not the host of the instance.
 * 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `InstanceNotHostError.message` to a hardcoded generic
 * `'You do not have permission to perform this action'`. The global
 * filter now preserves `exception.message` (default:
 * `'Only the host can perform this action'`).
 */
export class InstanceNotHostError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_HOST';
  constructor(message = INSTANCE_NOT_HOST_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the user tries to join an instance whose state is not
 * `'open'` (e.g. the instance is already running or closed). 400 Bad
 * Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `InstanceNotOpenError.message` to a hardcoded generic
 * `'Invalid request data'`. The global filter now preserves
 * `exception.message` (default: `'Instance is not open for
 * joining'`).
 */
export class InstanceNotOpenError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_OPEN';
  constructor(message = INSTANCE_NOT_OPEN_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the user tries to join an instance that has already
 * reached `maxPlayers`. 400 Bad Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `InstanceFullError.message` to a hardcoded generic `'Invalid
 * request data'`. The global filter now preserves `exception.message`
 * (default: `'Instance is full'`).
 */
export class InstanceFullError extends InstanceDomainError {
  readonly code = 'INSTANCE_FULL';
  constructor(message = INSTANCE_FULL_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the host tries to start an instance that has already
 * started. 400 Bad Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `InstanceAlreadyStartedError.message` to a hardcoded generic
 * `'Invalid request data'`. The global filter now preserves
 * `exception.message` (default: `'Instance has already started'`).
 */
export class InstanceAlreadyStartedError extends InstanceDomainError {
  readonly code = 'INSTANCE_ALREADY_STARTED';
  constructor(message = INSTANCE_ALREADY_STARTED_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the host tries to close an instance that is already
 * closed. 400 Bad Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `InstanceAlreadyClosedError.message` to a hardcoded generic
 * `'Invalid request data'`. The global filter now preserves
 * `exception.message` (default: `'Instance is already closed'`).
 */
export class InstanceAlreadyClosedError extends InstanceDomainError {
  readonly code = 'INSTANCE_ALREADY_CLOSED';
  constructor(message = INSTANCE_ALREADY_CLOSED_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the user tries to join an instance a second time. 409
 * Conflict.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `PlayerAlreadyJoinedError.message` to a hardcoded generic
 * `'Resource already exists'`. The global filter now preserves
 * `exception.message` (default: `'You have already joined this
 * instance'`).
 *
 * Note: this exception is defined and exported but is currently NOT
 * thrown by `instance.service.ts` (audit at rev4.5 completion: 0
 * grep hits). It is kept here as documentation / forward
 * compatibility — the global filter will resolve the code if a
 * future call site throws it.
 */
export class PlayerAlreadyJoinedError extends InstanceDomainError {
  readonly code = 'PLAYER_ALREADY_JOINED';
  constructor(message = PLAYER_ALREADY_JOINED_MESSAGE) {
    super(message);
  }
}
