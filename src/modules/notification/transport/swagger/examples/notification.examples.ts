import { EXAMPLE_TIMESTAMP } from './_timestamp';

const NOTIFICATION_ITEM = {
  notificationId: '550e8400-e29b-41d4-a716-446655440000',
  userId: '660e8400-e29b-41d4-a716-446655440000',
  type: 'achievement_earned',
  title: 'Achievement Unlocked!',
  message: 'You earned the "JavaScript Master" badge!',
  metadata: {
    badgeType: 'js_master',
    achievementType: 'mastery',
  },
  channel: 'in_app',
  isRead: false,
  readAt: null,
  createdAt: '2025-06-01T10:00:00.000Z',
  expiresAt: '2025-07-01T10:00:00.000Z',
};

/**
 * `GET /api/v1/notifications` — cursor-paginated list.
 * The `nextCursor` decodes to `{ createdAt, notificationId }` matching the
 * runtime cursor format in `notification-application.service.ts`.
 */
export const NOTIFICATION_LIST_EXAMPLE = {
  data: [NOTIFICATION_ITEM],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJub3RpZmljYXRpb25JZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
    },
  },
} as const;

/**
 * `GET /api/v1/notifications/unread-count` — single-resource DTO.
 */
export const NOTIFICATION_UNREAD_COUNT_EXAMPLE = {
  data: { count: 5 },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

/**
 * `GET /api/v1/notifications/analytics` — single-resource DTO.
 */
export const NOTIFICATION_ANALYTICS_EXAMPLE = {
  data: {
    total: 1248,
    unread: 73,
    byType: {
      achievement_earned: 450,
      rank_achievement: 300,
      discussion_reply: 498,
    },
    byChannel: {
      in_app: 1100,
      email: 148,
    },
    last24h: 85,
    last7d: 412,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

const NOTIFICATION_PREFERENCES = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  achievementEnabled: true,
  tournamentEnabled: true,
  rankEnabled: true,
  friendEnabled: true,
  discussionEnabled: true,
  summaryEnabled: true,
  marketingEnabled: false,
  rankImprovementThreshold: 5,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

/**
 * `GET /api/v1/notifications/preferences` — single-resource DTO.
 */
export const NOTIFICATION_PREFERENCES_EXAMPLE = {
  data: NOTIFICATION_PREFERENCES,
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

/**
 * `PATCH /api/v1/notifications/preferences` — request and response share the
 * same canonical envelope.
 */
export const NOTIFICATION_PREFERENCES_UPDATE_EXAMPLE = {
  data: NOTIFICATION_PREFERENCES,
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

/**
 * `GET /api/v1/notifications/{notificationId}` — single-resource DTO.
 */
export const NOTIFICATION_DETAIL_EXAMPLE = {
  data: NOTIFICATION_ITEM,
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

/**
 * `DELETE /api/v1/notifications/read` — body confirms how many read
 * notifications were deleted.
 */
export const NOTIFICATION_DELETED_READ_EXAMPLE = {
  data: { deletedCount: 3 },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
