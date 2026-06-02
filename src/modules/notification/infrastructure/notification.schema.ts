import {
  pgTable,
  index,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  check,
  sql,
} from 'drizzle-orm/pg-core';

export const notificationType = pgEnum('notification_type', [
  'achievement_earned',
  'badge_unlocked',
  'tournament_invite',
  'tournament_starting',
  'tournament_completed',
  'rank_improved',
  'streak_milestone',
  'friend_request',
  'friend_accepted',
  'quiz_commented',
  'weekly_summary',
  'system_announcement',
]);

export const notificationChannel = pgEnum('notification_channel', [
  'in_app',
  'email',
  'push',
]);

export const notifications = pgTable(
  'notifications',
  {
    notificationId: uuid('notification_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    type: notificationType().notNull(),
    title: text().notNull(),
    message: text().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    channel: notificationChannel().default('in_app').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_notifications_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_notifications_user_unread').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.isRead.asc().nullsLast().op('bool_ops'),
    ),
    index('idx_notifications_user_type').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.type.asc().nullsLast().op('enum_ops'),
    ),
    check('notifications_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    preferencesId: uuid('preferences_id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull().unique(),
    inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
    emailEnabled: boolean('email_enabled').default(true).notNull(),
    pushEnabled: boolean('push_enabled').default(true).notNull(),
    achievementEnabled: boolean('achievement_enabled').default(true).notNull(),
    tournamentEnabled: boolean('tournament_enabled').default(true).notNull(),
    rankEnabled: boolean('rank_enabled').default(true).notNull(),
    friendEnabled: boolean('friend_enabled').default(true).notNull(),
    summaryEnabled: boolean('summary_enabled').default(true).notNull(),
    marketingEnabled: boolean('marketing_enabled').default(false).notNull(),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_notification_preferences_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
);
