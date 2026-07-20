/**
 * Tournament Outbox Port
 *
 * Phase 3 / Issue #5 — Guarantee at-least-once delivery for tournament events.
 *
 * Events are dispatched via an in-memory bus and enqueued to BullMQ after
 * the transaction commits. If the application crashes between the commit and
 * the BullMQ enqueue, the event is lost forever.
 *
 * The fix is the canonical Transactional Outbox: write the event payload
 * into the existing `outbox_events` table inside the same transaction that
 * mutates tournament data, and let a worker drain the table and dispatch
 * to both the internal bus (for notification handlers) and the external bus
 * (for cross-module consumers like achievements/social).
 *
 * Producer-side idempotency: the outbox_events table has a partial unique
 * index `uq_outbox_events_idempotency_unprocessed` on idempotency_key WHERE
 * processed_at IS NULL. Tournament events carry explicit idempotency keys
 * (e.g. `tournament:joined:{tournamentId}:{userId}`). The insert uses
 * `ON CONFLICT DO NOTHING` so a duplicated event in the same transaction
 * does not raise a unique violation.
 *
 * For `tournament.won` events, the idempotency key is
 * `${tournamentId}:${userId}:${rank}` — the same key used in
 * `ExternalXpEarnedEvent.idempotencyKey` — so the XP consumer can dedupe
 * both the outbox event and the downstream XP grant.
 */

export const TOURNAMENT_OUTBOX_PORT = Symbol('TOURNAMENT_OUTBOX_PORT');

export type TournamentOutboxEventType =
  | 'tournament.joined'
  | 'tournament.participant.withdrawn'
  | 'tournament.starting_soon'
  | 'tournament.completed'
  | 'tournament.won';

export interface TournamentOutboxPayload {
  eventType: TournamentOutboxEventType;
  tournamentId: string;
  userId: string;
  // Event-specific fields
  tournamentTitle?: string;
  rank?: number;
  totalParticipants?: number;
  prize?: string;
  startedAt?: string;
  timestamp: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

export interface TournamentOutboxPort {
  /**
   * Schedule a tournament domain event to be processed by the outbox worker.
   *
   * The implementation MUST insert the row inside the supplied transaction
   * (`tx`) so the outbox write is atomic with the originating tournament
   * mutation. If the transaction rolls back, the outbox row never becomes
   * visible and the worker will not see a phantom event.
   *
   * @param params - event metadata including optional idempotency key
   * @param tx - the active Drizzle transaction client. Required for atomicity.
   * @param nowIso - the current timestamp (ISO string) for the `created_at` column
   */
  scheduleTournamentEvent(
    params: {
      eventType: TournamentOutboxEventType;
      payload: TournamentOutboxPayload;
      /** Deterministic key for duplicate detection, e.g. `tournament:joined:{tournamentId}:{userId}` */
      idempotencyKey: string;
      /** Correlation ID from the originating HTTP request for distributed tracing */
      correlationId?: string;
    },
    tx: unknown,
    nowIso: string,
  ): Promise<void>;
}
