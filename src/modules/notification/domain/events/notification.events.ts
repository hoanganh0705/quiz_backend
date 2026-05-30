/**
 * Notification Domain Events
 */

export interface NotificationSentEvent {
  readonly eventType: 'notification.sent';
  readonly userId: string;
  readonly notificationType: string;
  readonly channel: string;
  readonly timestamp: Date;
}

export interface NotificationReadEvent {
  readonly eventType: 'notification.read';
  readonly notificationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

export type NotificationDomainEvent = NotificationSentEvent | NotificationReadEvent;
