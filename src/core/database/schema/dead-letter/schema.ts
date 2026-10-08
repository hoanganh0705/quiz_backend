import { pgTable, index, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// =============================================================================
// Dead-letter Schema
//
// Tables: deadLetterEvents
//
// Forensic copy of items that exhausted their retry budget in the
// in-process retry queues. The live queue (`RetryQueue`) keeps a
// bounded JSON list in Redis for fast re-dispatch; once that list
// overflows, the dead-letter copy here is the durable record
// operators query when investigating "why did this event never
// land".
//
// This table is append-only. There are no foreign keys — a
// dead-letter event must outlive the aggregates it referenced,
// because the whole point is to diagnose failures after the
// fact.
// =============================================================================

// -----------------------------------------------------------------------------
// deadLetterEvents
// -----------------------------------------------------------------------------

export const deadLetterEvents = pgTable(
  'dead_letter_events',
  {
    eventId: uuid('event_id')
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    /** Logical retry-queue tier (`attempt`, `coin`, `comment`, ...). */
    tier: text('tier').notNull(),
    /** Stable identifier of the originating queue so ops can correlate to the Redis key. */
    sourceQueue: text('source_queue').notNull(),
    /** Snapshot of the event envelope at the moment it was dead-lettered. */
    event: jsonb('event').notNull(),
    /** Number of attempts the event survived before the final failure. */
    lastAttempt: integer('last_attempt').notNull(),
    /** Final error message reported by the handler. Truncated to a safe size. */
    lastError: text('last_error'),
    /** HTTP correlation ID at the time of failure, when one was attached. */
    correlationId: text('correlation_id'),
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_dead_letter_events_tier').using(
      'btree',
      table.tier.asc().nullsLast().op('text_ops'),
      table.deadLetteredAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_dead_letter_events_correlation').using(
      'btree',
      table.correlationId.asc().nullsLast().op('text_ops'),
    ),
  ],
);
