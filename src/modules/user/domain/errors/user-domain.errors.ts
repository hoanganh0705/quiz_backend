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

export class UserRankingNotFoundError extends UserDomainError {
  constructor(message = 'User ranking not found') {
    super(message);
  }
}

export class UserAnalyticsNotFoundError extends UserDomainError {
  constructor(message = 'User analytics not found') {
    super(message);
  }
}
