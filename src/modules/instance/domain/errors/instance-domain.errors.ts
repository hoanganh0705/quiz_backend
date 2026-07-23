import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  INSTANCE_ALREADY_CLOSED_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_ALREADY_FINISHED_MESSAGE,
  INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_IN_COUNTDOWN_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  INSTANCE_OPTIMISTIC_LOCK_MESSAGE,
  MIN_PLAYERS_NOT_MET_MESSAGE,
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
 * Thrown when the host tries to close an instance whose lifecycle is
 * already in the terminal `finished` state (e.g. archived via a
 * soft-delete flow). 400 Bad Request.
 *
 * Phase 3 (audit issue 7.1): previously conflated with
 * `InstanceAlreadyClosedError`, which made the wire shape ambiguous for
 * callers inspecting `extensions.code`. The two are now distinct:
 *   - `closed`   → user-closed (re-creatable by the host)
 *   - `finished` → terminal DB enum value, used for tombstoning
 */
export class InstanceAlreadyFinishedError extends InstanceDomainError {
  readonly code = 'INSTANCE_ALREADY_FINISHED';
  constructor(message = INSTANCE_ALREADY_FINISHED_MESSAGE) {
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
 * Phase 2 (audit issue 5.1): this exception is now thrown from
 * `instance.service.ts:joinInstance` when the duplicate case is
 * detected (the repository returns `{ joined: false }` for both
 * "duplicate" and "capacity reached", but Phase 2 routes capacity to
 * `InstanceFullError` and duplicates here — 409 instead of 400).
 */
export class PlayerAlreadyJoinedError extends InstanceDomainError {
  readonly code = 'PLAYER_ALREADY_JOINED';
  constructor(message = PLAYER_ALREADY_JOINED_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when a status transition's optimistic-locking predicate
 * (`WHERE version = $prev`) matches zero rows. 409 Conflict.
 *
 * Phase 1 (Foundational Correctness): previously `updateInstanceStatus`
 * performed an unconditional UPDATE keyed only on `instance_id`, so two
 * concurrent `startInstance` calls could each pass the in-memory
 * "status is open" check and both transition the row. The new
 * invariant is `WHERE instance_id = $1 AND version = $2`; a zero-row
 * result means another writer won the race and the caller should
 * re-read the instance and decide whether to retry.
 *
 * Surfaced to clients as a 409 with code `INSTANCE_OPTIMISTIC_LOCK`.
 */
export class InstanceOptimisticLockError extends InstanceDomainError {
  readonly code = 'INSTANCE_OPTIMISTIC_LOCK';
  constructor(message = INSTANCE_OPTIMISTIC_LOCK_MESSAGE) {
    super(message);
  }
}

/**
 * Phase 2 (Gameplay Lifecycle) — thrown when the host attempts to start
 * the countdown or the game, but fewer than `MIN_PLAYERS_PER_INSTANCE`
 * (currently 2 — instance is a multiplayer-only room per the review's
 * foundational correctness fix) players have joined. 422 Unprocessable
 * Entity.
 *
 * The pre-Phase-2 state machine skipped this check entirely: the host
 * could start a one-player game and the lobby collapsed on the first
 * disconnect. The review classifies multiplayer-only enforcement as a
 * "Required Fix"; the lifecycle of `startInstance` now requires
 * `currentPlayers >= 2` before any state transition is allowed.
 */
export class MinPlayersNotMetError extends InstanceDomainError {
  readonly code = 'MIN_PLAYERS_NOT_MET';
  constructor(message = MIN_PLAYERS_NOT_MET_MESSAGE) {
    super(message);
  }
}

/**
 * Phase 2 (Gameplay Lifecycle) — thrown when a countdown-only operation
 * (cancel, tick-completion, scheduler-driven `startInstance`) targets an
 * instance whose state is not `countdown`. 409 Conflict.
 *
 * The state-machine invariants are now:
 *   - `startCountdown` requires `status = 'open'`
 *   - `cancelCountdown` requires `status = 'countdown'`
 *   - The scheduler's `countdown → running` transition requires
 *     `status = 'countdown'`
 *
 * Any other state surfaces this error so the client sees a clear
 * `INSTANCE_NOT_IN_COUNTDOWN` rather than a generic `INSTANCE_OPTIMISTIC_LOCK`.
 */
export class InstanceNotInCountdownError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_IN_COUNTDOWN';
  constructor(message = INSTANCE_NOT_IN_COUNTDOWN_MESSAGE) {
    super(message);
  }
}

/**
 * Phase 2 (Gameplay Lifecycle) — thrown when `startCountdown` is invoked
 * on an instance whose status is already `countdown`. 409 Conflict.
 *
 * This is the natural idempotency guard. The repository's optimistic
 * lock would also reject a concurrent second call, but throwing here on
 * the optimistic lock would conflate two failure modes:
 *   - The client double-clicked the "start" button (deterministic
 *     `COUNTDOWN_ALREADY_STARTED` — the controller can return 200 with
 *     the current countdown anchor)
 *   - Two replicas raced on the same call (true
 *     `INSTANCE_OPTIMISTIC_LOCK`)
 *
 * The `startCountdown` controller therefore treats this error as a
 * "fetch the current state" instruction, while `INSTANCE_OPTIMISTIC_LOCK`
 * remains the genuine race signal.
 */
export class InstanceCountdownAlreadyStartedError extends InstanceDomainError {
  readonly code = 'INSTANCE_COUNTDOWN_ALREADY_STARTED';
  constructor(message = INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE) {
    super(message);
  }
}
