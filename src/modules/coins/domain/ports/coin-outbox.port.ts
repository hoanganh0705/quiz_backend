/**
 * Coin Outbox Port
 *
 * Mirrors `RankingOutboxPort` 1:1. The implementation is a thin
 * Drizzle insert into `outbox_events` with `aggregate_type = 'coin'`
 * and the partial unique index doing the deduplication.
 */

export interface CoinOutboxPort {
  /**
   * Schedule a coin domain event for async dispatch via the
   * transactional outbox processor. The event is inserted inside the
   * caller's transaction to guarantee atomicity with the wallet update.
   *
   * Idempotency: every coin event passes an explicit
   * `idempotencyKey` derived in §9.5. The partial unique index
   * `uq_outbox_events_idempotency_unprocessed WHERE processed_at IS
   * NULL AND idempotency_key IS NOT NULL` makes duplicate inserts in
   * the same transaction a no-op (the row never materializes) so the
   * caller does not have to handle a uniqueness violation here.
   */
  scheduleCoinEvent(
    params: {
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      idempotencyKey?: string;
    },
    tx: unknown,
  ): Promise<void>;
}

export const COIN_OUTBOX_PORT = Symbol('COIN_OUTBOX_PORT');
