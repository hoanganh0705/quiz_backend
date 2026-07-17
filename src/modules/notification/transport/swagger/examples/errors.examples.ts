import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

/**
 * Notification module error examples with endpoint-correct `instance` paths.
 *
 * Each notification endpoint's documented 4xx/5xx responses should use the example
 * returned by the matching factory below, so the spec mirrors the URL the
 * client actually requested.
 */

const withInstance = (
  base: (typeof ErrorResponseExamples)[keyof typeof ErrorResponseExamples],
  instance: string,
): Record<string, unknown> => ({ ...base, instance });

const SAMPLE_NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';

// ─── GET /notifications ──────────────────────────────────────────────────

export const listNotificationsBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/api/v1/notifications',
);
export const listNotificationsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications',
);
export const listNotificationsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications',
);

// ─── GET /notifications/unread-count ────────────────────────────────────

export const unreadCountUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/unread-count',
);
export const unreadCountInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/unread-count',
);

// ─── GET /notifications/analytics ──────────────────────────────────────

export const analyticsUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/analytics',
);
export const analyticsForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  '/api/v1/notifications/analytics',
);
export const analyticsInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/analytics',
);

// ─── GET /notifications/preferences ────────────────────────────────────

export const preferencesUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/preferences',
);
export const preferencesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/preferences',
);

// ─── PATCH /notifications/preferences ──────────────────────────────────

export const updatePreferencesBadRequestExample = withInstance(
  ErrorResponseExamples.badRequest,
  '/api/v1/notifications/preferences',
);
export const updatePreferencesUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/preferences',
);
export const updatePreferencesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/preferences',
);

// ─── GET /notifications/:notificationId ────────────────────────────────

export const getNotificationNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
export const getNotificationUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
export const getNotificationInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);

// ─── POST /notifications/:notificationId/read ───────────────────────────

export const markAsReadNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/read`,
);
export const markAsReadForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/read`,
);
export const markAsReadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/read`,
);

// ─── POST /notifications/:notificationId/unread ───────────────────────────

export const markAsUnreadNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/unread`,
);
export const markAsUnreadForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/unread`,
);
export const markAsUnreadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/unread`,
);

// ─── POST /notifications/read-all ────────────────────────────────────────

export const markAllAsReadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/read-all',
);
export const markAllAsReadInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/read-all',
);

// ─── DELETE /notifications/read ─────────────────────────────────────────

export const deleteReadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/read',
);
export const deleteReadInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/read',
);

// ─── DELETE /notifications/:notificationId ───────────────────────────────

export const deleteNotificationNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
export const deleteNotificationForbiddenExample = withInstance(
  ErrorResponseExamples.forbidden,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
export const deleteNotificationUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
