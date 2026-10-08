/**
 * Shared helpers for Redis-backed cron schedulers.
 *
 * Schedulers must distinguish two reasons an `acquireAdvisoryLock`
 * call can return `null`:
 *
 *   1. Another replica holds the lock. Expected at steady state;
 *      nothing to alert on.
 *   2. The Redis circuit is open. Means Redis itself is down;
 *      the entire background pipeline is stalled.
 *
 * The remediation plan calls for the second case to be observable
 * via `quiz_scheduler_skipped_total{job="..."}`. This helper centralises
 * the increment so every scheduler that follows the same pattern gets
 * the metric for free and operators see consistent labels.
 */

import type { CacheProvider } from '@/common/ports/cache.provider';
import type { RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import type { MetricsRegistry } from '@/core/observability/metrics.registry';

export type SchedulerLockResult<T> =
  | { acquired: true; token: string; run: () => Promise<T> }
  | { acquired: false; reason: 'held' | 'circuit_open' };

/**
 * Attempt to acquire the advisory lock. When the call returns `null`,
 * inspect the Redis circuit state to decide whether the skip is the
 * normal "another replica holds the lock" case or a circuit-open
 * stall (which we surface as `quiz_scheduler_skipped_total`).
 *
 * When the lock IS acquired, the caller is responsible for invoking
 * `releaseAdvisoryLock(lockKey, token)` inside a `finally`.
 */
export async function acquireSchedulerLockOrRecordSkip(args: {
  cache: CacheProvider;
  circuit: RedisCircuitPort;
  metrics: MetricsRegistry | undefined;
  lockKey: string;
  lockTtlMs: number;
  job: string;
}): Promise<SchedulerLockResult<never>> {
  const token = await args.cache.acquireAdvisoryLock(args.lockKey, args.lockTtlMs);
  if (token !== null) {
    return { acquired: true, token, run: () => Promise.reject(new Error('unreachable')) };
  }

  if (args.circuit.getCircuitState() === 'open') {
    args.metrics?.incSchedulerSkipped(args.job);
  }
  return {
    acquired: false,
    reason: args.circuit.getCircuitState() === 'open' ? 'circuit_open' : 'held',
  };
}
