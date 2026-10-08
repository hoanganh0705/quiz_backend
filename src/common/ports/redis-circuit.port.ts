/**
 * Redis circuit-breaker state port.
 *
 * Schedulers that hold a Redis advisory lock need to distinguish
 * "another replica is processing this tick" from "Redis itself is
 * down". The lock call short-circuits to `null` in both cases, but
 * the operator-facing signal is very different: the former is normal,
 * the latter means the entire background pipeline is stalled.
 *
 * The `CacheProvider` port intentionally does not expose the
 * circuit state — it is a Redis-implementation detail that callers
 * should not couple to. Consumers that need to make a decision
 * based on the circuit state inject `REDIS_CIRCUIT_PORT` instead.
 */

export type RedisCircuitState = 'closed' | 'open' | 'half_open';

export interface RedisCircuitPort {
  /**
   * Return the current circuit-breaker state. Cheap (in-process
   * read). Returns `'closed'` when Redis is healthy.
   */
  getCircuitState(): RedisCircuitState;
}

export const REDIS_CIRCUIT_PORT = Symbol('REDIS_CIRCUIT_PORT');
