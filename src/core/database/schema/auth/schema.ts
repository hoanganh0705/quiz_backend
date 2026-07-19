// =============================================================================
// Auth bounded context — schema
//
// Owns the user account and credential lifecycle:
//   - users                         (the central identity table; FK target
//                                    for nearly every domain in the system)
//   - userSessions                  (refresh tokens / device sessions)
//   - passwordResetTokens           (one-time password reset grants)
//   - sentVerificationTokens        (idempotency ledger for outbound emails)
//   - passwordHistory               (recent hashes for reuse prevention)
//   - authAuditLogs                 (security-relevant event history)
//
// Notes
//   - All other domains FK to `users`. They import this table from here.
//   - `oauthAccounts` is in the auth domain (lives in this file with the
//     other credential-tables) even though it is placed in the lower half
//     of the historical `index.ts`. The Phase 2 move brings it together
//     with the rest of the auth domain.
//   - `usersRelations` is declared in `./relations.ts` and exposes reverse
//     relations to many other domains (quizzes, ranking, etc.). The
//     forward FKs from those domains point at `users` from this file.
// =============================================================================

import {
  pgTable,
  index,
  uniqueIndex,
  unique,
  check,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  jsonb,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { userRole, tsvector } from '../shared';

// =============================================================================
// users
// =============================================================================

export const users = pgTable(
  'users',
  {
    userId: uuid('user_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    username: text().notNull(),
    userSearchVector: tsvector('user_search_vector'),
    email: text().notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole().default('user').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    emailVerificationTokenHash: text('email_verification_token_hash'),
    emailVerificationExpiresAt: timestamp('email_verification_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'string' }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'string' }),
    currentStreak: integer('current_streak').default(0).notNull(),
    longestStreak: integer('longest_streak').default(0).notNull(),
    // Most recent UTC calendar day on which the user has a completed
    // `quiz_attempts` row. Nullable: a user who has never completed an
    // attempt has `NULL`. The hot-path UPDATE in
    // `docs/plans/user-streak-system.md` §3.1 reads this column to
    // derive the next cache state.
    lastStreakDay: date('last_streak_day'),
    settings: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_users_active_created_at')
      .using('btree', table.createdAt.asc().nullsLast().op('timestamptz_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('uq_users_email_active')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`deleted_at IS NULL`),
    uniqueIndex('uq_users_username_active')
      .using('btree', table.username.asc().nullsLast().op('text_ops'))
      .where(sql`deleted_at IS NULL`),
    index('idx_users_email_verification_token_active')
      .using('btree', table.emailVerificationTokenHash.asc().nullsLast().op('text_ops'))
      .where(sql`deleted_at IS NULL AND is_verified = false`),
    index('idx_users_search_vector')
      .using('gin', table.userSearchVector)
      .where(sql`deleted_at IS NULL`),
    check('users_email_len', sql`(length((email)::text) >= 3) AND (length((email)::text) <= 255)`),
    check('users_email_like', sql`POSITION(('@'::text) IN (email)) > 1`),
    check('users_settings_object', sql`jsonb_typeof(settings) = 'object'::text`),
    check('users_streak_nonneg', sql`(current_streak >= 0) AND (longest_streak >= 0)`),
    check('users_streak_order', sql`longest_streak >= current_streak`),
    // `last_streak_day` may be NULL (no completed attempts ever) but
    // never future-dated — `finished_at` clock skew is bounded upstream
    // by the attempt repository.
    check(
      'users_streak_day_not_future',
      sql`(last_streak_day IS NULL) OR (last_streak_day <= CURRENT_DATE)`,
    ),
    check(
      'users_username_len',
      sql`(length((username)::text) >= 3) AND (length((username)::text) <= 50)`,
    ),
  ],
);

// =============================================================================
// userSessions
// =============================================================================

export const userSessions = pgTable(
  'user_sessions',
  {
    sessionId: uuid('session_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    jti: uuid('jti').notNull(),
    userId: uuid('user_id').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    deviceBrowser: text('device_browser'),
    deviceOs: text('device_os'),
    deviceType: text('device_type').default('unknown').notNull(),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    unique('uq_user_sessions_jti').on(table.jti),
    index('idx_user_sessions_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_sessions_jti_user').using(
      'btree',
      table.jti.asc().nullsLast().op('uuid_ops'),
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_user_sessions_active')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`revoked_at IS NULL`),
    index('idx_user_sessions_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_user_sessions_user_last_used_at').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.lastUsedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'user_sessions_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

// =============================================================================
// passwordResetTokens
// =============================================================================

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    passwordResetTokenId: uuid('password_reset_token_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    index('idx_password_reset_tokens_user_active')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`is_active = true AND used_at IS NULL AND revoked_at IS NULL`),
    index('idx_password_reset_tokens_hash_active')
      .using('btree', table.tokenHash.asc().nullsLast().op('text_ops'))
      .where(sql`is_active = true AND used_at IS NULL AND revoked_at IS NULL`),
  ],
);

// =============================================================================
// sentVerificationTokens
// =============================================================================

/**
 * Idempotency ledger for outbound verification emails.
 *
 * One row per token that has been handed to the email provider. Before
 * sending, the email processor attempts `INSERT … ON CONFLICT (token_hash)
 * DO NOTHING`; if a row already exists for the same token hash, the email
 * was already sent and the current job is a duplicate (BullMQ retry, replay
 * after crash) — the send is skipped.
 *
 * The TTL on each row is `EMAIL_VERIFICATION_TOKEN_TTL_SECONDS`; a
 * background purge job can delete expired rows so the table does not grow
 * without bound. The unique constraint on `token_hash` enforces that at
 * most one send per token ever happens, regardless of how many times the
 * BullMQ job is retried.
 */
export const sentVerificationTokens = pgTable(
  'sent_verification_tokens',
  {
    sentTokenId: uuid('sent_token_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').references(() => users.userId, { onDelete: 'set null' }),
    tokenHash: text('token_hash').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    uniqueIndex('uq_sent_verification_tokens_hash').on(table.tokenHash),
    index('idx_sent_verification_tokens_expires').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
  ],
);

// =============================================================================
// passwordHistory
// =============================================================================

export const passwordHistory = pgTable(
  'password_history',
  {
    historyId: uuid('history_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_password_history_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'password_history_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

// =============================================================================
// authAuditLogs
// =============================================================================

export const authAuditLogs = pgTable(
  'auth_audit_logs',
  {
    auditLogId: uuid('audit_log_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id'),
    eventType: text('event_type').notNull(),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_auth_audit_logs_created').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_auth_audit_logs_expires').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_auth_audit_logs_user_created').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'auth_audit_logs_user_id_fkey',
    }).onDelete('set null'),
    check('auth_audit_logs_metadata_object', sql`jsonb_typeof(metadata) = 'object'::text`),
  ],
);

// =============================================================================
// oauthAccounts
// =============================================================================

/**
 * OAuth account links: connects an external identity (Google, GitHub, Apple, Microsoft)
 * to an internal user. The `oauth_accounts.email` is intentionally omitted — email
 * is always sourced from `users.email`.
 *
 * Provider validity is enforced at the application layer, not via a database CHECK
 * constraint. This keeps the schema future-proof for new providers.
 */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    oauthAccountId: uuid('oauth_account_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    userId: uuid('user_id').notNull(),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_oauth_accounts_provider_provider_user_id').using(
      'btree',
      table.provider.asc().nullsLast().op('text_ops'),
      table.providerUserId.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('uq_oauth_accounts_user_id_provider').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.provider.asc().nullsLast().op('text_ops'),
    ),
    index('idx_oauth_accounts_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.userId],
      name: 'oauth_accounts_user_id_fkey',
    }).onDelete('cascade'),
  ],
);
