// =============================================================================
// Achievement bounded context — schema
//
// Owns the catalog of earnable badges, the rules that decide when they fire,
// and the per-user ledger of awarded badges:
//   - badges                   (the catalog; one row per badge)
//   - userBadges               (a user's earned (or revoked) badge instance)
//   - badgeRules               (per-badge condition configuration)
//
// Cross-domain FKs
//   - users (auth)             — userBadges.userId (award + revocation)
//
// Internal ordering note
//   `userBadges` and `badgeRules` both reference `badges.badgeId` directly.
//   Per the same lazy-FK-evaluation pattern used elsewhere in this schema
//   (see `ForeignKeyBuilder` — its `config` is stored as a callback and only
//   invoked when the table is built), the forward reference resolves at FK
//   build time even though `badges` is declared first here.
// =============================================================================

import {
  pgTable,
  index,
  unique,
  uniqueIndex,
  check,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { badgeCategory, badgeRuleType, badgeType } from '../shared';
import { users } from '../auth/schema';

// =============================================================================
// badges (the catalog; declared first to anchor the FK targets below)
// =============================================================================

export const badges = pgTable(
  'badges',
  {
    badgeId: uuid('badge_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    slug: text().notNull(),
    type: badgeType().notNull(),
    category: badgeCategory().notNull(),
    name: text().notNull(),
    description: text(),
    iconUrl: text('icon_url'),
    isActive: boolean('is_active').default(true).notNull(),
    isHidden: boolean('is_hidden').default(false).notNull(),
    version: text('version').default('1.0.0').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true, mode: 'string' }),
    validUntil: timestamp('valid_until', { withTimezone: true, mode: 'string' }),
    evaluationMode: text('evaluation_mode').default('immediate').notNull(), // 'immediate' | 'deferred' | 'both'
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_badges_slug').on(table.slug),
    index('idx_badges_type').using('btree', table.type.asc().nullsLast().op('enum_ops')),
    index('idx_badges_category').using('btree', table.category.asc().nullsLast().op('enum_ops')),
    index('idx_badges_active').using('btree', table.isActive.asc().nullsLast().op('bool_ops')),
    index('idx_badges_evaluation_mode').using(
      'btree',
      table.evaluationMode.asc().nullsLast().op('text_ops'),
    ),
    check('badges_name_nonblank', sql`length(btrim(name)) > 0`),
    check(
      'badges_slug_format',
      sql`(slug = lower(slug)) AND (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)`,
    ),
    check(
      'badges_evaluation_mode_check',
      sql`evaluation_mode = ANY (ARRAY['immediate'::text, 'deferred'::text, 'both'::text])`,
    ),
  ],
);

// =============================================================================
// userBadges
// =============================================================================

export const userBadges = pgTable(
  'user_badges',
  {
    userBadgeId: uuid('user_badge_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    badgeId: uuid('badge_id').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    badgeVersion: text('badge_version').default('1.0.0').notNull(),
    progress: jsonb('progress').default({}).notNull(),
    metadata: jsonb().default({}).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    revocationReason: text('revocation_reason'),
  },
  (table) => [
    index('idx_user_badges_badge_id').using(
      'btree',
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_badges_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    index('idx_user_badges_earned_at').using(
      'btree',
      table.earnedAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_badges_active').using(
      'btree',
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_badges_user_active_earned').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
      table.earnedAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_badges_user_badge_active').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.badgeId.asc().nullsLast().op('uuid_ops'),
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    // Partial unique constraint on (userId, badgeId) for active records.
    // Prevents race-condition duplicate awards — the DB rejects the second concurrent INSERT.
    // Uses .on() because uniqueIndex().where() only supports a single column via sql`` syntax.
    uniqueIndex('uq_user_badges_user_badge_active')
      .on(
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.badgeId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`${table.revokedAt} IS NULL`),
    // Composite B-tree with (userId, badgeId) leading key — covers the hasBadge()
    // query: WHERE user_id = $1 AND badge_id = $2 AND revoked_at IS NULL.
    index('idx_user_badges_user_badge').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_badges_cursor_pagination').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.revokedAt.asc().nullsLast().op('timestamptz_ops'),
      table.earnedAt.desc().nullsLast().op('timestamptz_ops'),
      table.userBadgeId.desc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.badgeId],
      foreignColumns: [badges.badgeId],
      name: 'user_badges_badge_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_badges_user_id_fkey',
    }).onDelete('cascade'),
    check('user_badges_progress_object', sql`jsonb_typeof(progress) = 'object'::text`),
    check('user_badges_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

// =============================================================================
// badgeRules
//
// Flexible rule configuration for badge conditions.
// Each badge can have multiple rules that must all be satisfied.
//
// Rule config examples:
// - { "metric": "quizzes_completed", "threshold": 10, "operator": ">=" }
// - { "metric": "period_rank", "period": "weekly", "threshold": 10, "operator": "<=" }
// - { "metric": "streak_days", "threshold": 30, "operator": ">=" }
// - { "metric": "tournaments_won", "threshold": 3, "operator": ">=" }
// - { "metric": "perfect_scores", "threshold": 10, "operator": ">=" }
// - { "metric": "xp_total", "threshold": 5000, "operator": ">=" }
// =============================================================================

export const badgeRules = pgTable(
  'badge_rules',
  {
    ruleId: uuid('rule_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    badgeId: uuid('badge_id').notNull(),
    ruleType: badgeRuleType('rule_type').notNull(),
    priority: integer('priority').default(0).notNull(),
    config: jsonb().notNull().default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_badge_rules_badge_id').using(
      'btree',
      table.badgeId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_badge_rules_rule_type').using(
      'btree',
      table.ruleType.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_badge_rules_active_priority').using(
      'btree',
      table.isActive.asc().nullsLast().op('bool_ops'),
      table.priority.desc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.badgeId],
      foreignColumns: [badges.badgeId],
      name: 'badge_rules_badge_id_fkey',
    }).onDelete('cascade'),
    check(
      'badge_rules_config_not_null',
      sql`config IS NOT NULL AND jsonb_typeof(config) = 'object'`,
    ),
  ],
);
