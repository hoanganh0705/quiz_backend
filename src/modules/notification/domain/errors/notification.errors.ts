/**
 * Notification Domain Errors
 */

export class NotificationDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'NotificationDomainError';
  }
}

export class NotificationSendError extends NotificationDomainError {
  constructor(userId: string, reason: string) {
    super(`Failed to send notification to user ${userId}: ${reason}`, 'NOTIFICATION_SEND_ERROR', {
      userId,
      reason,
    });
    this.name = 'NotificationSendError';
  }
}

export class NotificationNotFoundError extends NotificationDomainError {
  constructor(notificationId: string) {
    super(`Notification not found: ${notificationId}`, 'NOTIFICATION_NOT_FOUND', {
      notificationId,
    });
    this.name = 'NotificationNotFoundError';
  }
}
