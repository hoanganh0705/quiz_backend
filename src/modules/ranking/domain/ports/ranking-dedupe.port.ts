/**
 * Ranking Dedupe Port
 *
 * Provides a cross-replica short-circuit guard for XP ingestion so the same
 * idempotency key is processed at most once per TTL window, even when both the
 * in-process fast path and the outbox slow path are racing on the same event.
 *
 * ## Failure semantics
 *
 * The dedupe store is Redis with circuit-breaker semantics inherited from the
 * Redis client. When Redis is unavailable, callers must fail open and proceed
 * with processing so a Redis outage never blocks leaderboard updates. The
 * authoritative gate for correctness remains the partial unique index on
 * `outbox_events(idempotency_key)` for unprocessed rows.
 */

export type XpIngestSource = 'in_proc' | 'outbox' | 'manual';

export interface RankingDedupePort {
  /**
   * Try to claim ownership of an idempotency key for `ttlSeconds` seconds.
   * Returns true when the caller is the first to claim the key in this window.
   * Returns false when another producer (in-proc, outbox, or a different replica)
   * already owns the key.
   *
   * On Redis unavailability, returns true and the caller MUST log a warning —
   * this is a fail-open policy.
   */
  tryClaimXp(idempotencyKey: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Release a previously-claimed key so a retry can re-attempt processing.
   * Called when downstream processing throws after the claim succeeded, so the
   * caller doesn't permanently block retries until the TTL expires.
   */
  releaseXp(idempotencyKey: string): Promise<void>;
}

export const RANKING_DEDUPE_PORT = Symbol('RANKING_DEDUPE_PORT');
