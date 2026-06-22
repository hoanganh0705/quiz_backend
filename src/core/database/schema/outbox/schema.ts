import {
  pgTable,
  index,
  uniqueIndex,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// Outbox Domain Schema
//
// Tables: outboxEvents, idempotencyKeys
// These tables have no foreign keys to any other domain.
// =============================================================================

// -----------------------------------------------------------------------------
// outboxEvents
// -----------------------------------------------------------------------------

export const outboxEvents = pgTable(
  'outbox_events',
  {
    eventId: uuid('event_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    aggregateType: text('aggregate_type').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    attemptCount: integer('attempt_count').default(0).notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'string' }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    lastError: text('last_error'),
    /** Client-provided key for XP event deduplication. */
    idempotencyKey: text('idempotency_key'),
    /** Timestamp when the event exhausted all retry attempts and moved to DLQ. */
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'string' }),
    /** Human-readable reason for DLQ placement. */
    dlqReason: text('dlq_reason'),
    /** Tracks the HTTP correlation ID chain through async processing. */
    correlationId: text('correlation_id'),
  },
  (table) => [
    index('idx_outbox_events_unprocessed').using(
      'btree',
      table.processedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_outbox_events_created').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_outbox_events_next_attempt').using(
      'btree',
      table.processedAt.asc().nullsLast().op('timestamptz_ops'),
      table.nextAttemptAt.asc().nullsLast().op('timestamptz_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_outbox_events_idempotency_unprocessed').using(
      'btree',
      table.idempotencyKey.asc().nullsLast().op('text_ops'),
    ),
    // Partial unique index on the idempotency key for unprocessed events.
    // Once an event is processed, its row is preserved for audit (and a
    // future event with the same key — e.g. a manual resend — should still
    // be insertable), so the uniqueness only constrains the live queue.
    uniqueIndex('uq_outbox_events_idempotency_unprocessed')
      .on(table.idempotencyKey.asc().nullsLast().op('text_ops'))
      .where(sql`processed_at IS NULL AND idempotency_key IS NOT NULL`),
  ],
);

// -----------------------------------------------------------------------------
// idempotencyKeys
// -----------------------------------------------------------------------------

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 255 }).primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    operation: varchar('operation', { length: 64 }).notNull(),
    response: jsonb('response'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_idempotency_keys_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_idempotency_keys_user_operation').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.operation.asc().nullsLast().op('text_ops'),
    ),
  ],
);
