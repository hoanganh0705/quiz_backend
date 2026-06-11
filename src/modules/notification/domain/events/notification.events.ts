/**
 * Notification Domain Events
 *
 * Published when significant notification state changes occur,
 * allowing other domains to react (e.g. WebSocket push, audit logs, analytics).
 */

export interface NotificationSentEvent {
  readonly eventType: 'notification.sent';
  readonly notificationId: string;
  readonly userId: string;
  readonly type: string;
  readonly channel: string;
  readonly timestamp: Date;
}

export interface NotificationReadEvent {
  readonly eventType: 'notification.read';
  readonly notificationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

export interface NotificationUnreadEvent {
  readonly eventType: 'notification.unread';
  readonly notificationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

export interface NotificationDeletedEvent {
  readonly eventType: 'notification.deleted';
  readonly notificationId: string;
  readonly userId: string;
  readonly timestamp: Date;
}

export type NotificationDomainEvent =
  | NotificationSentEvent
  | NotificationReadEvent
  | NotificationUnreadEvent
  | NotificationDeletedEvent;
