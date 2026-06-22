// =============================================================================
// Ranking bounded context — schema
//
// Owns the per-user competitive state and its history:
//   - userRanking                   (current all-time / weekly / monthly /
//                                    daily XP and rank for each user)
//   - rankRecalculationWorkItems    (queue of (user, period) pairs whose
//                                    rank needs recomputing; collapses
//                                    concurrent enqueues via a unique
//                                    constraint)
//   - rankHistory                   (persisted snapshots over time)
//   - rankingMilestones             (top-N achievements like TOP_100)
//
// Cross-domain FKs
//   - users (auth)                  — every row anchors to a single user
// =============================================================================

import {
  pgTable,
  index,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from '../auth/schema';

// =============================================================================
// userRanking
// =============================================================================

export const userRanking = pgTable(
  'user_ranking',
  {
    userId: uuid('user_id').primaryKey().notNull(),
    allTimeXp: integer('all_time_xp').default(0).notNull(),
    weeklyXp: integer('weekly_xp').default(0).notNull(),
    monthlyXp: integer('monthly_xp').default(0).notNull(),
    allTimeRank: integer('all_time_rank'),
    weeklyRank: integer('weekly_rank'),
    monthlyRank: integer('monthly_rank'),
    dailyRank: integer('daily_rank'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    // Phase 1 enhancements
    lastWeeklyResetAt: timestamp('last_weekly_reset_at', { withTimezone: true, mode: 'string' }),
    lastMonthlyResetAt: timestamp('last_monthly_reset_at', { withTimezone: true, mode: 'string' }),
    lastDailyResetAt: timestamp('last_daily_reset_at', { withTimezone: true, mode: 'string' }),
    peakAllTimeRank: integer('peak_all_time_rank'),
    peakAllTimeRankAchievedAt: timestamp('peak_all_time_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    peakWeeklyRank: integer('peak_weekly_rank'),
    peakWeeklyRankAchievedAt: timestamp('peak_weekly_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    peakMonthlyRank: integer('peak_monthly_rank'),
    peakMonthlyRankAchievedAt: timestamp('peak_monthly_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    peakDailyRank: integer('peak_daily_rank'),
    peakDailyRankAchievedAt: timestamp('peak_daily_rank_achieved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    dailyXp: integer('daily_xp').default(0).notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true, mode: 'string' }),
    isDirty: boolean('is_dirty').default(false).notNull(),
  },
  (table) => [
    index('idx_user_ranking_all_time_rank').using(
      'btree',
      table.allTimeRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_weekly_rank').using(
      'btree',
      table.weeklyRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_monthly_rank').using(
      'btree',
      table.monthlyRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_daily_rank').using(
      'btree',
      table.dailyRank.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_user_ranking_dirty').using('btree', table.isDirty.asc().nullsLast().op('bool_ops')),
    index('idx_user_ranking_user_dirty_updated').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.isDirty.asc().nullsLast().op('bool_ops'),
      table.updatedAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_ranking_user_id_fkey',
    }).onDelete('cascade'),
    check('user_ranking_all_time_xp_nonneg', sql`all_time_xp >= 0`),
    check('user_ranking_weekly_xp_nonneg', sql`weekly_xp >= 0`),
    check('user_ranking_monthly_xp_nonneg', sql`monthly_xp >= 0`),
    check('user_ranking_daily_xp_nonneg', sql`daily_xp >= 0`),
    check(
      'user_ranking_all_time_rank_positive',
      sql`(all_time_rank IS NULL) OR (all_time_rank > 0)`,
    ),
    check('user_ranking_weekly_rank_positive', sql`(weekly_rank IS NULL) OR (weekly_rank > 0)`),
    check('user_ranking_monthly_rank_positive', sql`(monthly_rank IS NULL) OR (monthly_rank > 0)`),
    check('user_ranking_daily_rank_positive', sql`(daily_rank IS NULL) OR (daily_rank > 0)`),
  ],
);

// =============================================================================
// rankRecalculationWorkItems
//
// One row per (user, period) that needs its rank recomputed. The unique
// constraint on (user_id, period) makes `markDirty` a no-op when the
// same (user, period) pair is enqueued twice — concurrent XP events for
// the same user in the same period collapse to a single work item.
//
// The batch processor selects rows from this table, computes the new
// rank, and deletes the consumed rows. The `is_dirty` boolean on
// `user_ranking` is a separate "this user has any pending work" latch
// for fast existence checks; this table is the authoritative per-period
// work queue.
// =============================================================================

export const rankRecalculationWorkItems = pgTable(
  'rank_recalculation_work_items',
  {
    workItemId: uuid('work_item_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_rank_recalculation_work_items_user_period').on(
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.period.asc().nullsLast().op('text_ops'),
    ),
    index('idx_rank_recalculation_work_items_enqueued').using(
      'btree',
      table.enqueuedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    check(
      'rank_recalculation_work_items_period_valid',
      sql`period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text])`,
    ),
  ],
);

// =============================================================================
// rankHistory — Stores persisted ranking snapshots over time.
// =============================================================================

export const rankHistory = pgTable(
  'rank_history',
  {
    historyId: uuid('history_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    period: text('period').notNull(), // 'daily' | 'weekly' | 'monthly' | 'all_time'
    snapshotDate: timestamp('snapshot_date', { withTimezone: true, mode: 'string' }).notNull(),
    rank: integer('rank').notNull(),
    xp: integer('xp').default(0).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_rank_history_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    index('idx_rank_history_period').using('btree', table.period.asc().nullsLast().op('text_ops')),
    index('idx_rank_history_user_period').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.period.asc().nullsLast().op('text_ops'),
    ),
    index('idx_rank_history_snapshot_date').using(
      'btree',
      table.snapshotDate.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_rank_history_user_period_snapshot').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.period.asc().nullsLast().op('text_ops'),
      table.snapshotDate.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'rank_history_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'rank_history_period_valid',
      sql`period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'all_time'::text])`,
    ),
  ],
);

// =============================================================================
// rankingMilestones
// =============================================================================

export const rankingMilestones = pgTable(
  'ranking_milestones',
  {
    id: uuid('id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    milestone: text('milestone').notNull(),
    rank: integer('rank').notNull(),
    achievedAt: timestamp('achieved_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_ranking_milestones_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_ranking_milestones_achieved_at').using(
      'btree',
      table.achievedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('uq_ranking_milestones_user_milestone').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.milestone.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'ranking_milestones_user_id_fkey',
    }).onDelete('cascade'),
    check('ranking_milestones_rank_positive', sql`rank > 0`),
    check(
      'ranking_milestones_milestone_valid',
      sql`milestone = ANY (ARRAY['TOP_10000'::text, 'TOP_1000'::text, 'TOP_100'::text, 'TOP_50'::text, 'TOP_10'::text, 'TOP_3'::text, 'TOP_1'::text])`,
    ),
  ],
);
