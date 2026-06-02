import {
  pgTable,
  index,
  uuid,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  pgEnum,
  check,
  sql,
} from 'drizzle-orm/pg-core';

export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'rejected',
  'blocked',
]);

export const friendships = pgTable(
  'friendships',
  {
    friendshipId: uuid('friendship_id').defaultRandom().primaryKey().notNull(),
    requesterId: uuid('requester_id').notNull(),
    addresseeId: uuid('addressee_id').notNull(),
    status: friendshipStatus().default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
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
    index('idx_friendships_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    uniqueIndex('uq_friendships_pair').on(
      table.requesterId.asc().nullsLast().op('uuid_ops'),
      table.addresseeId.asc().nullsLast().op('uuid_ops'),
    ),
    check(
      'friendships_no_self_request',
      sql`requester_id != addressee_id`,
    ),
  ],
);

export const blockedUsers = pgTable(
  'blocked_users',
  {
    blockId: uuid('block_id').defaultRandom().primaryKey().notNull(),
    blockerId: uuid('blocker_id').notNull(),
    blockedId: uuid('blocked_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
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
    uniqueIndex('uq_blocked_users_pair').on(
      table.blockerId.asc().nullsLast().op('uuid_ops'),
      table.blockedId.asc().nullsLast().op('uuid_ops'),
    ),
    check(
      'blocked_users_no_self_block',
      sql`blocker_id != blocked_id`,
    ),
  ],
);

export const userFollows = pgTable(
  'user_follows',
  {
    followId: uuid('follow_id').defaultRandom().primaryKey().notNull(),
    followerId: uuid('follower_id').notNull(),
    followingId: uuid('following_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
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
    uniqueIndex('uq_user_follows_pair').on(
      table.followerId.asc().nullsLast().op('uuid_ops'),
      table.followingId.asc().nullsLast().op('uuid_ops'),
    ),
    check(
      'user_follows_no_self_follow',
      sql`follower_id != following_id`,
    ),
  ],
);
