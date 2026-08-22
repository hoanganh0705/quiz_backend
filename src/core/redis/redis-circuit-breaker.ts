/**
 * Redis circuit breaker.
 *
 * Phase 2 #1 of the resilience roadmap (see `BACKEND_AUDIT_REPORT.md`
 * §23 Phase 2).
 *
 * Wraps every Redis call so a flapping or fully-down Redis cannot take
 * down the API for read traffic. The breaker is configured to
 * **fail-open** for rate-limit checks: when Redis is unreachable for
 * longer than the cool-down, the breaker opens and every subsequent
 * call returns the supplied `fallback` value (zero for counters, the
 * cached value for `getOrSet`) instead of throwing.
 *
 * Why fail-open?
 * --------------
 * The previous behaviour was "Redis down → every request 500s". The
 * actual damage from a missing rate-limit check is several orders of
 * magnitude smaller than the damage from a fully-out API. The fail-open
 * trade-off is documented and the breaker stays observable: every
 * state transition emits a structured log line, and the in-memory
 * counters are exposed by the health endpoint so the operator can
 * see exactly how many requests have been let through during the
 * outage.
 *
 * Design choices
 * --------------
 * - Reuses the existing `CircuitBreaker` primitive in
 *   `common/resilience/circuit-breaker.ts`. The state machine is the
 *   same — only the *policy* (open → fail open vs. open → throw) is
 *   different.
 * - The breaker is **per-process**. A pod restart resets the counter.
 *   That is intentional: the breaker is a short-term protection
 *   against a flapping upstream, not a long-term rate limit.
 * - The wrapped methods are a strict subset of `CacheProvider`. The
 *   goal is to gate the operations that a missing Redis would actually
 *   turn into 500s, not to wrap every Redis call site.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreaker, CircuitOpenError, type CircuitState } from '@/common/resilience/circuit-breaker';

export type RedisCircuitMetrics = {
  state: CircuitState;
  consecutiveFailures: number;
  /**
   * Total number of calls that were short-circuited by the breaker
   * (i.e. the breaker was open and the fallback was returned). This
   * is the metric operators watch for during a Redis outage: it is
   * the count of "we let the request through because Redis was down".
   */
  shortCircuitedCount: number;
};

export type RedisCircuitBreakerOptions = {
  failureThreshold: number;
  resetTimeoutMs: number;
  /**
   * Optional clock for tests. Defaults to `Date.now`.
   */
  now?: () => number;
};

@Injectable()
export class RedisCircuitBreaker {
  private readonly breaker: CircuitBreaker;
  private readonly logger = new Logger(RedisCircuitBreaker.name);
  private shortCircuitedCount = 0;

  constructor(options: RedisCircuitBreakerOptions) {
    if (options.failureThreshold <= 0) {
      throw new Error('RedisCircuitBreaker: failureThreshold must be > 0');
    }
    if (options.resetTimeoutMs <= 0) {
      throw new Error('RedisCircuitBreaker: resetTimeoutMs must be > 0');
    }
    this.breaker = new CircuitBreaker({
      failureThreshold: options.failureThreshold,
      resetTimeoutMs: options.resetTimeoutMs,
      now: options.now,
    });

    this.breaker.setStateChangeListener(({ from, to }) => {
      this.logger.warn({
        event: 'redis_circuit_state',
        from,
        to,
        consecutiveFailures: this.breaker.getConsecutiveFailures(),
      });
    });
  }

  getState(): CircuitState {
    return this.breaker.getState();
  }

  getConsecutiveFailures(): number {
    return this.breaker.getConsecutiveFailures();
  }

  getShortCircuitedCount(): number {
    return this.shortCircuitedCount;
  }

  getMetrics(): RedisCircuitMetrics {
    return {
      state: this.breaker.getState(),
      consecutiveFailures: this.breaker.getConsecutiveFailures(),
      shortCircuitedCount: this.shortCircuitedCount,
    };
  }

  /**
   * Subscribe to breaker state transitions. Returns an unsubscribe
   * function. Used by the health endpoint to expose transition events
   * to the platform team.
   */
  setStateChangeListener(
    listener: (transition: { from: CircuitState; to: CircuitState }) => void,
  ): () => void {
    return this.breaker.setStateChangeListener(listener);
  }

  /**
   * Run `task` through the breaker. If the breaker is open, return
   * `fallback` WITHOUT calling `task`. The fallback is the
   * fail-open response — for example `0` for a rate-limit counter,
   * or `null` for a cache get.
   *
   * Callers MUST treat the fallback as "Redis is down, give the
   * caller the safe answer". For rate-limit checks that means
   * allowing the request (returning 0 is below every limit).
   */
  async exec<T>(fallback: T, task: () => Promise<T>): Promise<T> {
    try {
      return await this.breaker.exec(task);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.shortCircuitedCount += 1;
        this.logger.warn({
          event: 'redis_circuit_short_circuited',
          state: error.state,
          shortCircuitedCount: this.shortCircuitedCount,
        });
        return fallback;
      }
      throw error;
    }
  }
}

export const REDIS_CIRCUIT_BREAKER = Symbol('REDIS_CIRCUIT_BREAKER');