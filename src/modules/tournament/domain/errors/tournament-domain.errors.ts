import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Tournament-module namespace marker for tournament-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, and tag modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new TournamentDomainError' src/` returns no matches.
 */
export abstract class TournamentDomainError extends BaseDomainException {}

/**
 * Thrown by `TournamentService` when a tournament cannot be found by id.
 * 404 Not Found.
 */
export class TournamentNotFoundError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_NOT_FOUND';
  constructor(message = 'Tournament not found') {
    super(message);
  }
}

/**
 * Thrown when a tournament round cannot be found. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter hardcoded the
 * message to `'Tournament round not found'`. The global filter now
 * preserves `exception.message`.
 */
export class TournamentRoundNotFoundError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_ROUND_NOT_FOUND';
  constructor(message = 'Tournament round not found') {
    super(message);
  }
}

/**
 * Thrown when the authenticated user is not registered for the
 * tournament. 404 Not Found (the participant record does not exist).
 */
export class TournamentNotRegisteredError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_NOT_REGISTERED';
  constructor(message = 'You are not registered for this tournament') {
    super(message);
  }
}

/**
 * Thrown when the authenticated user lacks permission to perform a
 * tournament action. 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `TournamentForbiddenError.message` to a hardcoded generic
 * `'You do not have permission to perform this action'`, ignoring the
 * thrown message. The global filter now preserves `exception.message`,
 * so call sites that throw
 * `new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE)` surface
 * `'You do not have permission to manage this tournament'` verbatim.
 */
export class TournamentForbiddenError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_FORBIDDEN';
  constructor(message = 'You do not have permission to manage this tournament') {
    super(message);
  }
}

/**
 * Generic tournament state conflict (caller should usually prefer a
 * more specific subclass). 409 Conflict.
 */
export class TournamentConflictError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_CONFLICT';
  constructor(message = 'Resource conflict') {
    super(message);
  }
}

/**
 * Thrown when the user tries to register for a tournament they are
 * already actively participating in. 409 Conflict.
 */
export class TournamentAlreadyRegisteredError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_ALREADY_REGISTERED';
  constructor(message = 'You are already registered for this tournament') {
    super(message);
  }
}

/**
 * Thrown when the user tries to start an attempt for a round they have
 * already submitted. 409 Conflict.
 */
export class TournamentAttemptAlreadyExistsError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_ATTEMPT_ALREADY_EXISTS';
  constructor(message = 'You have already submitted an attempt for this round') {
    super(message);
  }
}

/**
 * Thrown when the participant is in an unexpected state for the
 * requested operation. 409 Conflict.
 *
 * Required-arg ctor (like `UserProfilePrivateError`): the message is
 * always meaningful because each call site surfaces a specific state
 * mismatch. There is no useful default.
 */
export class TournamentParticipantStateError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_PARTICIPANT_STATE';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when the user tries to withdraw a second time. 409 Conflict.
 *
 * Wire-shape fix (not a regression): the prior per-module filter did
 * NOT include this exception in `mapToHttp`, so it fell through to the
 * default `INTERNAL_SERVER_ERROR` with a generic
 * `'Internal server error'` message — an implicit bug. Phase 2 routes
 * it to 409 (semantic state conflict).
 *
 * Audit: this exception is currently only used by
 * `tournament-withdraw.spec.ts` (the unit test asserts `instanceof
 * TournamentAlreadyWithdrawnError`). It is preserved with a sensible
 * 409 mapping so the spec continues to pass.
 */
export class TournamentAlreadyWithdrawnError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_ALREADY_WITHDRAWN';
  constructor(message = 'You have already withdrawn from this tournament') {
    super(message);
  }
}

/**
 * Thrown when tournament parameters fail validation
 * (e.g. `endAt <= startAt`). 400 Bad Request.
 */
export class TournamentValidationError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_VALIDATION';
  constructor(message = 'Validation failed') {
    super(message);
  }
}

/**
 * Thrown when the user tries to register after the registration phase
 * has ended. 400 Bad Request.
 */
export class TournamentRegistrationClosedError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_REGISTRATION_CLOSED';
  constructor(message = 'Tournament registration is closed') {
    super(message);
  }
}

/**
 * Thrown when the tournament has reached `maxParticipants`. 400 Bad
 * Request.
 */
export class TournamentFullError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_FULL';
  constructor(message = 'Tournament is full') {
    super(message);
  }
}

/**
 * Thrown when the user tries to start an attempt for a round that is
 * not in `'open'` status. 400 Bad Request.
 */
export class TournamentRoundNotOpenError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_ROUND_NOT_OPEN';
  constructor(message = 'Tournament round is not open') {
    super(message);
  }
}

/**
 * Thrown when the user tries to unregister outside the registration
 * phase. 400 Bad Request.
 */
export class TournamentUnregisterClosedError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_UNREGISTER_CLOSED';
  constructor(
    message = 'You can only unregister from an upcoming or registration-phase tournament',
  ) {
    super(message);
  }
}

/**
 * Thrown when the user tries to withdraw outside the `'ongoing'`
 * tournament phase. 400 Bad Request.
 */
export class TournamentWithdrawClosedError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_WITHDRAW_CLOSED';
  constructor(message = 'Tournament withdrawal is only allowed while the tournament is active') {
    super(message);
  }
}

/**
 * Phase 1 / Issue #1 — thrown when an admin-only mutation
 * (update / soft-delete / cancel) is attempted against a tournament
 * that lives in a terminal lifecycle state (`finished` or
 * `cancelled`). 409 Conflict.
 *
 * The wire-message is intentionally generic — the controller
 * surfaces the exact `currentStatus` through the `extensions`
 * bag returned by `GlobalExceptionFilter`.
 */
export class TournamentTerminalStateError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_TERMINAL_STATE';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Phase 1 / Issue #1 — thrown when a `PATCH /tournaments/:id`
 * attempts to *shrink* `maxParticipants` while the tournament is in
 * `registration`. Shrinking the cap would silently evict already-
 * registered users; the only legal change in `registration` is to
 * raise the cap. 409 Conflict.
 */
export class TournamentCapacityReductionError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_CAPACITY_REDUCTION';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Phase 1 / Issue #1 — thrown when a `PATCH /tournaments/:id`
 * ships an empty body (no field provided). The route must always
 * touch at least one column or the operation is meaningless.
 * 400 Bad Request.
 */
export class TournamentEmptyUpdateError extends TournamentDomainError {
  readonly code = 'TOURNAMENT_EMPTY_UPDATE';
  constructor(message = 'At least one field must be provided to update a tournament') {
    super(message);
  }
}
