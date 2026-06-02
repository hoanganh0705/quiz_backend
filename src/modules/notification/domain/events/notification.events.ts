/**
 * Notification Domain Events
 *
 * Defines all events emitted by the Notification Domain.
 */

/**
 * Event emitted when a notification is sent to a user.
 */
export interface NotificationSentEvent {
  readonly eventType: 'notification.sent';
  readonly notificationId: string;
  readonly userId: string;
  readonly notificationType: string;
  readonly channel: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when a notification is read by a user.
 */
export interface NotificationReadEvent {
  readonly eventType: 'notification.read';
  readonly notificationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when all notifications are marked as read.
 */
export interface AllNotificationsReadEvent {
  readonly eventType: 'notification.all_read';
  readonly userId: string;
  readonly count: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when a notification is deleted.
 */
export interface NotificationDeletedEvent {
  readonly eventType: 'notification.deleted';
  readonly notificationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

/**
 * Union type of all notification domain events.
 */
export type NotificationDomainEvent =
  | NotificationSentEvent
  | NotificationReadEvent
  | AllNotificationsReadEvent
  | NotificationDeletedEvent;
