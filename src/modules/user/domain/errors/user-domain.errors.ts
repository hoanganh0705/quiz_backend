export class UserDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserNotFoundError extends UserDomainError {
  constructor(message = 'User not found') {
    super(message);
  }
}
