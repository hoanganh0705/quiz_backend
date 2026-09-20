export const NOTIFICATION_THROTTLE_VALUES = {
  listNotifications: { limit: 120, ttl: 60_000 },
  getUnreadCount: { limit: 240, ttl: 60_000 },
  getAnalytics: { limit: 60, ttl: 60_000 },
  getPreferences: { limit: 120, ttl: 60_000 },
  updatePreferences: { limit: 20, ttl: 60_000 },
  getNotificationDetail: { limit: 240, ttl: 60_000 },
  markAsRead: { limit: 60, ttl: 60_000 },
  markAsUnread: { limit: 60, ttl: 60_000 },
  markAllAsRead: { limit: 10, ttl: 60_000 },
  deleteReadNotifications: { limit: 10, ttl: 60_000 },
  deleteNotification: { limit: 30, ttl: 60_000 },
} as const;

export type NotificationThrottleConfig = typeof NOTIFICATION_THROTTLE_VALUES;
