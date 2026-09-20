import { BaseDomainException } from '@/common/errors/base-domain.exception';
export abstract class NotificationError extends BaseDomainException {}

export class NotificationNotFoundError extends NotificationError {
  readonly code = 'NOTIFICATION_NOT_FOUND';
  constructor(id: string) {
    super(`Notification not found: ${id}`);
  }
}

export class NotificationForbiddenError extends NotificationError {
  readonly code = 'NOTIFICATION_FORBIDDEN';
  constructor(notificationId: string) {
    super(`You do not have permission to access notification ${notificationId}`);
  }
}
