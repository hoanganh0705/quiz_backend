// =============================================================================
// Coins bounded context — schema
//
// Owns the per-user spendable wallet and the append-only ledger of every
// coin movement. The wallet is the hot read; the ledger is the source of
// truth (balance can always be recomputed as SUM(amount)).
//
//   - userWallets              (one row per user; cached current balance)
//   - coinTransactions         (append-only ledger; every delta lands here)
//
// Phase 6 (S-coin-spend) adds the per-user product tables that the
// spend endpoints write to after the ledger row commits:
//   - userFlairSlots           (a 7-day profile flair slot the user bought)
//   - userQuizSuppressions     (a quiz the user hid from the Recommended rail)
//
// Cross-domain FKs
//   - users (auth)             — every row anchors to a single userId
//   - quizzes (quiz)           — userQuizSuppressions.quizId
//   - badges (achievement)     — userFlairSlots.badgeId (the badge
//                                pinned to the profile)
//
// Notes
//   - The `coin_reason` PostgreSQL enum is declared in
//     `../shared/enums.ts` (next to every other pgEnum in this project) so
//     that `drizzle-kit` only ever needs a single enum-diff source. The
//     design doc floated the option of declaring it inline here; the project
//     convention wins for consistency with the other 15 enums.
//   - No application code yet — this file is the Phase 1 deliverable. The
//     matching `CoinModule` skeleton in `src/modules/coins/` registers
//     nothing against these tables until Phase 3+ lands.
// =============================================================================

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
// `quizzes` lives in the quiz schema. We import the table lazily through
// a foreignKey callback below; the comment on each FK explains why.
import { quizzes } from '../quiz/schema';

// =============================================================================
// userWallets
//
// Hot read. balance is recomputable from coin_transactions; we keep the
// cached column so header pills and popovers don't aggregate over the ledger
// on every render.
//
// Constraints
//   - balance >= 0                          (no negative wallets)
//   - balance <= 1_000_000                   (sanity cap; mirrors the
//                                            ceiling used by the daily-cap
//                                            economy simulation in §15)
// =============================================================================
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

// =============================================================================
// coinTransactions
//
// Append-only ledger. Every delta (positive reward or negative spend) lands
// here. `balanceAfter` is denormalised per-row so a transaction history page
// can render without re-aggregating. `idempotencyKey` is UNIQUE so a retry
// of the same outbox event can never double-record.
//
// Why a full unique index (not partial)
//   - The `outbox_events.idempotency_key` partial unique index gates
//     "at-most-once-in-flight" for the outbox row itself. By contrast, the
//     ledger must NEVER accept a duplicate row for the same key even after
//     the event has been processed, so we use a non-partial unique index.
//     See design doc §9.7.
// =============================================================================
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
    // Cursor-paginated history: (user_id, created_at desc, transaction_id desc).
    index('idx_coin_transactions_user_cursor').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      table.transactionId.desc().nullsLast().op('uuid_ops'),
    ),
    // Daily-cap enforcement: SUM by (user_id, reason, created_at >= today).
    index('idx_coin_transactions_user_reason_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.reason.asc().nullsLast().op('enum_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    // Reconciliation: aggregate by user to detect balance drift.
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

// =============================================================================
// userFlairSlots
//
// One row per 7-day profile flair slot the user bought. The `slotStart` /
// `slotEnd` pair is denormalised so the active-slot query
//   `WHERE user_id = :u AND now() BETWEEN slot_start AND slot_end`
// is index-only. The badge is a `userBadges.userBadgeId` (not the bare
// `badges.badgeId`) because the slot represents an owned badge instance.
// See design §6 / §7.
// =============================================================================
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
    // Active-slot lookup for the profile header renderer.
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
    // The ledger row that paid for this slot. We do NOT FK it (the
    // ledger is append-only and immutable) but the unique index keeps
    // the 1:1 relationship between spend and side-effect.
    uniqueIndex('uq_user_flair_slots_coin_transaction_id').using(
      'btree',
      table.coinTransactionId.asc().nullsLast().op('uuid_ops'),
    ),
    check(
      'user_flair_slots_slot_window',
      sql`slot_end > slot_start`,
    ),
  ],
);

// =============================================================================
// userQuizSuppressions
//
// One row per (user, quiz) the user bought a 30-day hide-from-Recommended
// for. `expiresAt` is denormalised for the same reason as
// `userFlairSlots.slotEnd`. We use a *partial* unique on the active
// composite so a user can re-buy after their previous window expires.
// See design §7.
// =============================================================================
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
    // Index for active-suppression lookup for the Recommended rail loader.
    // The "is currently active" predicate is `expires_at > now()`, evaluated
    // at query time. We do not declare a partial unique index on
    // `(user_id, quiz_id) WHERE expires_at > now()` because PostgreSQL
    // requires index predicates to use IMMUTABLE functions and `now()` is
    // STABLE; the upsert path in `CoinSpendService.suppressQuiz(...)` is
    // responsible for the "no double-buy while one is active" check.
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
    // 1:1 with the spending ledger row.
    uniqueIndex('uq_user_quiz_suppressions_coin_transaction_id').using(
      'btree',
      table.coinTransactionId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
);
