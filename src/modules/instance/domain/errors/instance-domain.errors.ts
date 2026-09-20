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
  INSTANCE_NOT_RUNNING_MESSAGE,
  INSTANCE_OPTIMISTIC_LOCK_MESSAGE,
  MIN_PLAYERS_NOT_MET_MESSAGE,
  PLAYER_ALREADY_JOINED_MESSAGE,
  PLAYER_NOT_IN_INSTANCE_MESSAGE,
  PLAYER_ATTEMPT_NOT_READY_MESSAGE,
} from '../../instance.constants';

export abstract class InstanceDomainError extends BaseDomainException {}

export class InstanceNotFoundError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_FOUND';
  constructor(message = INSTANCE_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

export class InstanceNotHostError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_HOST';
  constructor(message = INSTANCE_NOT_HOST_MESSAGE) {
    super(message);
  }
}

export class InstanceNotOpenError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_OPEN';
  constructor(message = INSTANCE_NOT_OPEN_MESSAGE) {
    super(message);
  }
}

export class InstanceFullCapacityError extends BaseDomainException {
  readonly code = 'INSTANCE_FULL';
  constructor(readonly maxPlayers: number) {
    super(`Instance has reached maximum capacity of ${maxPlayers} players`);
  }
}

export class InstanceFullError extends InstanceDomainError {
  readonly code = 'INSTANCE_FULL';
  constructor(message = INSTANCE_FULL_MESSAGE) {
    super(message);
  }
}

export class InstanceAlreadyStartedError extends InstanceDomainError {
  readonly code = 'INSTANCE_ALREADY_STARTED';
  constructor(message = INSTANCE_ALREADY_STARTED_MESSAGE) {
    super(message);
  }
}

export class InstanceAlreadyClosedError extends InstanceDomainError {
  readonly code = 'INSTANCE_ALREADY_CLOSED';
  constructor(message = INSTANCE_ALREADY_CLOSED_MESSAGE) {
    super(message);
  }
}

export class InstanceAlreadyFinishedError extends InstanceDomainError {
  readonly code = 'INSTANCE_ALREADY_FINISHED';
  constructor(message = INSTANCE_ALREADY_FINISHED_MESSAGE) {
    super(message);
  }
}

export class PlayerAlreadyJoinedError extends InstanceDomainError {
  readonly code = 'PLAYER_ALREADY_JOINED';
  constructor(message = PLAYER_ALREADY_JOINED_MESSAGE) {
    super(message);
  }
}

export class InstanceOptimisticLockError extends InstanceDomainError {
  readonly code = 'INSTANCE_OPTIMISTIC_LOCK';
  constructor(message = INSTANCE_OPTIMISTIC_LOCK_MESSAGE) {
    super(message);
  }
}

export class MinPlayersNotMetError extends InstanceDomainError {
  readonly code = 'MIN_PLAYERS_NOT_MET';
  constructor(message = MIN_PLAYERS_NOT_MET_MESSAGE) {
    super(message);
  }
}

export class InstanceNotInCountdownError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_IN_COUNTDOWN';
  constructor(message = INSTANCE_NOT_IN_COUNTDOWN_MESSAGE) {
    super(message);
  }
}

export class InstanceCountdownAlreadyStartedError extends InstanceDomainError {
  readonly code = 'INSTANCE_COUNTDOWN_ALREADY_STARTED';
  constructor(message = INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE) {
    super(message);
  }
}

export class PlayerNotInInstanceError extends InstanceDomainError {
  readonly code = 'PLAYER_NOT_IN_INSTANCE';
  constructor(message = PLAYER_NOT_IN_INSTANCE_MESSAGE) {
    super(message);
  }
}

export class PlayerAttemptNotReadyError extends InstanceDomainError {
  readonly code = 'PLAYER_ATTEMPT_NOT_READY';
  constructor(message = PLAYER_ATTEMPT_NOT_READY_MESSAGE) {
    super(message);
  }
}

export class InstanceNotRunningError extends InstanceDomainError {
  readonly code = 'INSTANCE_NOT_RUNNING';
  constructor(message = INSTANCE_NOT_RUNNING_MESSAGE) {
    super(message);
  }
}
