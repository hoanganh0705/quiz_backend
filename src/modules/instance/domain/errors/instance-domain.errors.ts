export class InstanceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InstanceNotFoundError extends InstanceDomainError {
  constructor(message = 'Quiz instance not found') {
    super(message);
  }
}

export class InstanceFullError extends InstanceDomainError {
  constructor(message = 'Instance is full') {
    super(message);
  }
}

export class InstanceNotOpenError extends InstanceDomainError {
  constructor(message = 'Instance is not open for joining') {
    super(message);
  }
}

export class InstanceNotHostError extends InstanceDomainError {
  constructor(message = 'Only the host can perform this action') {
    super(message);
  }
}

export class InstanceAlreadyStartedError extends InstanceDomainError {
  constructor(message = 'Instance has already started') {
    super(message);
  }
}

export class InstanceAlreadyClosedError extends InstanceDomainError {
  constructor(message = 'Instance is already closed') {
    super(message);
  }
}

export class PlayerAlreadyJoinedError extends InstanceDomainError {
  constructor(message = 'You have already joined this instance') {
    super(message);
  }
}
