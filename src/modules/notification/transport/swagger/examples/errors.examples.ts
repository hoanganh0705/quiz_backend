import { ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

const withInstance = (
  base: (typeof ErrorResponseExamples)[keyof typeof ErrorResponseExamples],
  instance: string,
): Record<string, unknown> => ({ ...base, instance });

const SAMPLE_NOTIFICATION_ID = '550e8400-e29b-71d4-a716-446655440000';

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

export const unreadCountUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/unread-count',
);
export const unreadCountInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/unread-count',
);

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

export const preferencesUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/preferences',
);
export const preferencesInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/preferences',
);

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

export const markAsReadNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/read`,
);
export const markAsReadForbiddenExample = {
  ...ErrorResponseExamples.forbidden,
  detail: `You do not have permission to access notification ${SAMPLE_NOTIFICATION_ID}`,
  instance: `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/read`,
};
export const markAsReadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/read`,
);

export const markAsUnreadNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/unread`,
);
export const markAsUnreadForbiddenExample = {
  ...ErrorResponseExamples.forbidden,
  detail: `You do not have permission to access notification ${SAMPLE_NOTIFICATION_ID}`,
  instance: `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/unread`,
};
export const markAsUnreadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}/unread`,
);

export const markAllAsReadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/read-all',
);
export const markAllAsReadInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/read-all',
);

export const deleteReadUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  '/api/v1/notifications/read-all',
);
export const deleteReadInternalErrorExample = withInstance(
  ErrorResponseExamples.internalServerError,
  '/api/v1/notifications/read-all',
);

export const deleteNotificationNotFoundExample = withInstance(
  ErrorResponseExamples.notFound,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
export const deleteNotificationForbiddenExample = {
  ...ErrorResponseExamples.forbidden,
  detail: `You do not have permission to access notification ${SAMPLE_NOTIFICATION_ID}`,
  instance: `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
};
export const deleteNotificationUnauthorizedExample = withInstance(
  ErrorResponseExamples.unauthorized,
  `/api/v1/notifications/${SAMPLE_NOTIFICATION_ID}`,
);
