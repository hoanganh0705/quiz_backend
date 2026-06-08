export class TournamentDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TournamentNotFoundError extends TournamentDomainError {
  constructor(message = 'Tournament not found') {
    super(message);
  }
}

export class TournamentForbiddenError extends TournamentDomainError {
  constructor(message = 'You do not have permission to manage this tournament') {
    super(message);
  }
}

export class TournamentConflictError extends TournamentDomainError {
  constructor(message = 'Resource conflict') {
    super(message);
  }
}

export class TournamentValidationError extends TournamentDomainError {
  constructor(message = 'Validation failed') {
    super(message);
  }
}

export class TournamentRegistrationClosedError extends TournamentDomainError {
  constructor(message = 'Tournament registration is closed') {
    super(message);
  }
}

export class TournamentFullError extends TournamentDomainError {
  constructor(message = 'Tournament is full') {
    super(message);
  }
}

export class TournamentAlreadyRegisteredError extends TournamentDomainError {
  constructor(message = 'You are already registered for this tournament') {
    super(message);
  }
}

export class TournamentRoundNotFoundError extends TournamentDomainError {
  constructor(message = 'Tournament round not found') {
    super(message);
  }
}

export class TournamentRoundNotOpenError extends TournamentDomainError {
  constructor(message = 'Tournament round is not open') {
    super(message);
  }
}

export class TournamentAttemptAlreadyExistsError extends TournamentDomainError {
  constructor(message = 'You have already submitted an attempt for this round') {
    super(message);
  }
}

export class TournamentNotRegisteredError extends TournamentDomainError {
  constructor(message = 'You are not registered for this tournament') {
    super(message);
  }
}

export class TournamentUnregisterClosedError extends TournamentDomainError {
  constructor(
    message = 'You can only unregister from an upcoming or registration-phase tournament',
  ) {
    super(message);
  }
}

export class TournamentAlreadyWithdrawnError extends TournamentDomainError {
  constructor(message = 'You have already withdrawn from this tournament') {
    super(message);
  }
}

export class TournamentWithdrawClosedError extends TournamentDomainError {
  constructor(message = 'Tournament withdrawal is only allowed while the tournament is active') {
    super(message);
  }
}
