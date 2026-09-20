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
  tournamentTitle?: string;
  rank?: number;
  totalParticipants?: number;
  prize?: string;
  startedAt?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface TournamentOutboxScheduleParams {
  eventType: TournamentOutboxEventType;
  payload: TournamentOutboxPayload;
  idempotencyKey: string;
  correlationId?: string;
}

export interface TournamentOutboxPort {
  /**
   * Schedule a single tournament domain event for the outbox worker.
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
    params: TournamentOutboxScheduleParams,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;

  /**
   * Schedule a batch of tournament domain events in a single multi-row insert.
   *
   * Used by bulk producers (e.g. `dispatchStartingSoonNotifications` fanning
   * out a notification to every participant of a tournament) to avoid the
   * N+1 round-trip cost of calling `scheduleTournamentEvent` per recipient.
   *
   * Semantics are identical to `scheduleTournamentEvent`: each row carries
   * its own idempotency key and the insert is `ON CONFLICT DO NOTHING` so
   * duplicate keys within the batch are silently dropped. The insert runs
   * inside the supplied transaction so the entire batch is atomic with the
   * caller's mutation.
   *
   * @param events - the list of events to schedule
   * @param tx - the active Drizzle transaction client
   * @param nowIso - the current timestamp (ISO string) for `created_at`
   */
  scheduleTournamentEventsBatch(
    events: ReadonlyArray<TournamentOutboxScheduleParams>,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;
}
