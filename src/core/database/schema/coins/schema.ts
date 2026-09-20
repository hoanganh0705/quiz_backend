import {
  pgTable,
  index,
  uniqueIndex,
  check,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { coinReason } from '../shared/enums';
import { users } from '../auth/schema';
import { userBadges, badges } from '../achievement/schema';

import { quizzes } from '../quiz/schema';

export const userWallets = pgTable(
  'user_wallets',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    balance: integer('balance').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_wallets_user_id_fkey',
    }).onDelete('cascade'),
    check('user_wallets_balance_nonneg', sql`${table.balance} >= 0`),
    check('user_wallets_balance_max', sql`${table.balance} <= 1000000`),
  ],
);

export const coinTransactions = pgTable(
  'coin_transactions',
  {
    transactionId: uuid('transaction_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    reason: coinReason().notNull(),
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_coin_transactions_user_cursor').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      table.transactionId.desc().nullsLast().op('uuid_ops'),
    ),
    index('idx_coin_transactions_user_reason_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.reason.asc().nullsLast().op('enum_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_coin_transactions_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_coin_transactions_idempotency_key').using(
      'btree',
      table.idempotencyKey.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'coin_transactions_user_id_fkey',
    }).onDelete('cascade'),
    check('coin_transactions_amount_nonzero', sql`${table.amount} <> 0`),
    check('coin_transactions_balance_after_nonneg', sql`${table.balanceAfter} >= 0`),
    check(
      'coin_transactions_metadata_object',
      sql`jsonb_typeof(${table.metadata}) = 'object'::text`,
    ),
  ],
);

export const userFlairSlots = pgTable(
  'user_flair_slots',
  {
    slotId: uuid('slot_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    userBadgeId: uuid('user_badge_id').notNull(),
    badgeId: uuid('badge_id').notNull(),
    slotStart: timestamp('slot_start', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    slotEnd: timestamp('slot_end', { withTimezone: true, mode: 'string' }).notNull(),
    coinTransactionId: uuid('coin_transaction_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_flair_slots_active').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.slotEnd.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_flair_slots_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userBadgeId],
      foreignColumns: [userBadges.userBadgeId],
      name: 'user_flair_slots_user_badge_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.badgeId],
      foreignColumns: [badges.badgeId],
      name: 'user_flair_slots_badge_id_fkey',
    }).onDelete('restrict'),
    uniqueIndex('uq_user_flair_slots_coin_transaction_id').using(
      'btree',
      table.coinTransactionId.asc().nullsLast().op('uuid_ops'),
    ),
    check('user_flair_slots_slot_window', sql`slot_end > slot_start`),
  ],
);

export const userQuizSuppressions = pgTable(
  'user_quiz_suppressions',
  {
    suppressionId: uuid('suppression_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    quizId: uuid('quiz_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    coinTransactionId: uuid('coin_transaction_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_quiz_suppressions_user_quiz').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.quizId.asc().nullsLast().op('uuid_ops'),
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_quiz_suppressions_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.quizId],
      foreignColumns: [quizzes.quizId],
      name: 'user_quiz_suppressions_quiz_id_fkey',
    }).onDelete('cascade'),
    uniqueIndex('uq_user_quiz_suppressions_coin_transaction_id').using(
      'btree',
      table.coinTransactionId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
);
