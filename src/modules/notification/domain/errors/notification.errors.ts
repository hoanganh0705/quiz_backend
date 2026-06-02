export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class NotificationNotFoundError extends NotificationError {
  constructor(id: string) {
    super(`Notification not found: ${id}`);
    this.name = 'NotificationNotFoundError';
  }
}

export class NotificationForbiddenError extends NotificationError {
  constructor() {
    super('You do not have permission to access this notification');
    this.name = 'NotificationForbiddenError';
  }
}
