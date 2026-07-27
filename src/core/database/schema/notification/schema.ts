import {
  pgTable,
  index,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { notificationType, notificationChannel } from '../shared';
import { users } from '../auth/schema';

// =============================================================================
// Notification Domain Schema
//
// Tables: notifications, notificationPreferences
// All FK references point to users (from auth domain).
// =============================================================================

// -----------------------------------------------------------------------------
// notifications
// -----------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    notificationId: uuid('notification_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
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
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_notifications_user_created')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_notifications_user_unread')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.isRead.asc().nullsLast().op('bool_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_notifications_user_type')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.type.asc().nullsLast().op('enum_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    index('idx_notifications_expires_at')
      .using('btree', table.expiresAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`expires_at IS NOT NULL`),
    // Phase 5 (Performance Optimization) — GIN index for metadata queries
    // Enables efficient lookups on JSONB fields like metadata->>'achievementId'
    index('idx_notifications_metadata').using('gin', sql`metadata`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'notifications_user_id_fkey',
    }).onDelete('cascade'),
    check('notifications_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

// -----------------------------------------------------------------------------
// notificationPreferences
// -----------------------------------------------------------------------------

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    preferencesId: uuid('preferences_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull().unique(),
    inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
    emailEnabled: boolean('email_enabled').default(true).notNull(),
    pushEnabled: boolean('push_enabled').default(true).notNull(),
    achievementEnabled: boolean('achievement_enabled').default(true).notNull(),
    tournamentEnabled: boolean('tournament_enabled').default(true).notNull(),
    rankEnabled: boolean('rank_enabled').default(true).notNull(),
    friendEnabled: boolean('friend_enabled').default(true).notNull(),
    commentEnabled: boolean('comment_enabled').default(true).notNull(),
    summaryEnabled: boolean('summary_enabled').default(true).notNull(),
    marketingEnabled: boolean('marketing_enabled').default(false).notNull(),
    rankImprovementThreshold: integer('rank_improvement_threshold').default(5).notNull(),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_notification_preferences_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'notification_preferences_user_id_fkey',
    }).onDelete('cascade'),
    check('notification_preferences_threshold_positive', sql`rank_improvement_threshold > 0`),
  ],
);
