import {
  pgTable,
  index,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  jsonb,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { socialFeedActivityType, friendshipStatus } from '../shared';
import { users } from '../auth/schema';

// =============================================================================
// Social Domain Schema
//
// Tables: socialFeedActivities, friendships, blockedUsers, userFollows
// All FK references point to users (from auth domain).
// =============================================================================

// -----------------------------------------------------------------------------
// socialFeedActivities
// -----------------------------------------------------------------------------

export const socialFeedActivities = pgTable(
  'social_feed_activities',
  {
    activityId: uuid('activity_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    activityType: socialFeedActivityType('activity_type').notNull(),
    payload: jsonb('payload').default({}).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_social_feed_activities_occurred').using(
      'btree',
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
      table.activityId.desc().nullsLast().op('uuid_ops'),
    ),
    index('idx_social_feed_activities_user_occurred').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_social_feed_activities_type_occurred').using(
      'btree',
      table.activityType.asc().nullsLast().op('enum_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'social_feed_activities_user_id_fkey',
    }).onDelete('cascade'),
    check('social_feed_activities_payload_object', sql`jsonb_typeof(payload) = 'object'::text`),
    check('social_feed_activities_payload_not_empty', sql`payload <> '{}'::jsonb`),
  ],
);

// -----------------------------------------------------------------------------
// friendships
// -----------------------------------------------------------------------------

export const friendships = pgTable(
  'friendships',
  {
    friendshipId: uuid('friendship_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    requesterId: uuid('requester_id').notNull(),
    addresseeId: uuid('addressee_id').notNull(),
    status: friendshipStatus().default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_friendships_requester').using(
      'btree',
      table.requesterId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_friendships_addressee').using(
      'btree',
      table.addresseeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_friendships_status').using('btree', table.status.asc().nullsLast().op('enum_ops')),
    index('idx_friendships_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_friendships_pair')
      .on(
        table.requesterId.asc().nullsLast().op('uuid_ops'),
        table.addresseeId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    foreignKey({
      columns: [table.requesterId],
      foreignColumns: [users.userId],
      name: 'friendships_requester_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.addresseeId],
      foreignColumns: [users.userId],
      name: 'friendships_addressee_id_fkey',
    }).onDelete('cascade'),
    check('friendships_no_self_request', sql`requester_id != addressee_id`),
  ],
);

// -----------------------------------------------------------------------------
// blockedUsers
// -----------------------------------------------------------------------------

export const blockedUsers = pgTable(
  'blocked_users',
  {
    blockId: uuid('block_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    blockerId: uuid('blocker_id').notNull(),
    blockedId: uuid('blocked_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_blocked_users_blocker').using(
      'btree',
      table.blockerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_blocked_users_blocked').using(
      'btree',
      table.blockedId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_blocked_users_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_blocked_users_pair')
      .on(
        table.blockerId.asc().nullsLast().op('uuid_ops'),
        table.blockedId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    foreignKey({
      columns: [table.blockerId],
      foreignColumns: [users.userId],
      name: 'blocked_users_blocker_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.blockedId],
      foreignColumns: [users.userId],
      name: 'blocked_users_blocked_id_fkey',
    }).onDelete('cascade'),
    check('blocked_users_no_self_block', sql`blocker_id != blocked_id`),
  ],
);

// -----------------------------------------------------------------------------
// userFollows
// -----------------------------------------------------------------------------

export const userFollows = pgTable(
  'user_follows',
  {
    followId: uuid('follow_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    followerId: uuid('follower_id').notNull(),
    followingId: uuid('following_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_user_follows_follower').using(
      'btree',
      table.followerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_follows_following').using(
      'btree',
      table.followingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_follows_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_user_follows_pair')
      .on(
        table.followerId.asc().nullsLast().op('uuid_ops'),
        table.followingId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`deleted_at IS NULL`),
    foreignKey({
      columns: [table.followerId],
      foreignColumns: [users.userId],
      name: 'user_follows_follower_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.followingId],
      foreignColumns: [users.userId],
      name: 'user_follows_following_id_fkey',
    }).onDelete('cascade'),
    check('user_follows_no_self_follow', sql`follower_id != following_id`),
  ],
);
