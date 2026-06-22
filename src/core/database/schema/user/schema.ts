// =============================================================================
// User bounded context — schema
//
// Owns the per-user profile, the privacy/visibility settings that govern
// what the rest of the app can show, and the activity feed entries that
// record what each user has done:
//   - userProfiles           (display name, avatar, bio, tagline, pinned badges)
//   - userProfileSettings    (per-user visibility toggles for the profile UI)
//   - userActivityEvents     (append-only feed of user-visible activity)
//
// Cross-domain FKs
//   - users (auth)           — every table anchors to a single userId
// =============================================================================

import {
  pgTable,
  index,
  check,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { activityEventType } from '../shared';
import { users } from '../auth/schema';

// =============================================================================
// userProfiles
// =============================================================================

export const userProfiles = pgTable(
  'user_profiles',
  {
    profileId: uuid('profile_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull().unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    bio: text(),
    tagline: text('tagline'),
    pinnedBadgeIds: jsonb('pinned_badge_ids').default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_profiles_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_profiles_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'user_profiles_display_name_len',
      sql`(display_name IS NULL) OR (length(btrim(display_name)) >= 1 AND length(btrim(display_name)) <= 100)`,
    ),
    check('user_profiles_tagline_len', sql`(tagline IS NULL) OR (length(btrim(tagline)) <= 160)`),
    check('user_profiles_pinned_badges_array', sql`jsonb_typeof(pinned_badge_ids) = 'array'`),
  ],
);

// =============================================================================
// userProfileSettings
// =============================================================================

export const userProfileSettings = pgTable(
  'user_profile_settings',
  {
    settingsId: uuid('settings_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull().unique(),
    isPublic: boolean('is_public').default(true).notNull(),
    showStatistics: boolean('show_statistics').default(true).notNull(),
    showAchievements: boolean('show_achievements').default(true).notNull(),
    showActivity: boolean('show_activity').default(true).notNull(),
    showRankImprovement: boolean('show_rank_improvement').default(true).notNull(),
    showTournamentActivity: boolean('show_tournament_activity').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_profile_settings_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_profile_settings_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

// =============================================================================
// userActivityEvents
// =============================================================================

export const userActivityEvents = pgTable(
  'user_activity_events',
  {
    eventId: uuid('event_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    eventType: activityEventType().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    visibility: text('visibility').default('public').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_user_activity_events_user_occurred').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_activity_events_user_type').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.eventType.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_user_activity_events_visibility').using(
      'btree',
      table.visibility.asc().nullsLast().op('text_ops'),
      table.occurredAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_activity_events_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_activity_events_cursor_pagination').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
      table.eventId.desc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_activity_events_user_id_fkey',
    }).onDelete('cascade'),
    check(
      'user_activity_events_visibility_check',
      sql`visibility = ANY (ARRAY['public'::text, 'private'::text])`,
    ),
    check('user_activity_events_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
    check('user_activity_events_metadata_not_empty', sql`metadata <> '{}'::jsonb`),
  ],
);
