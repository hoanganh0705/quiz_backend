/**
 * Per-cache hit/miss instrumentation.
 *
 * The cache surface is a free-form set of namespaced keys spread
 * across many modules. To make the hit-rate of each cache
 * observable we centralise the `cache.get(...)` invocation in a
 * single helper that:
 *
 *   1. Tags the read with a `cache` label (e.g. `quiz-list`,
 *      `quiz-stats`, `user-profile-bundle`).
 *   2. Increments `quiz_cache_hit_total{cache="..."}` on a hit and
 *      `quiz_cache_miss_total{cache="..."}` on a miss.
 *
 * Consumers call `instrumentedGet(cacheProvider, metricsRegistry,
 * key, cache)` instead of `cacheProvider.get(key)`. The helper is
 * tolerant of a missing `MetricsRegistry` so unit tests and other
 * contexts without metrics wiring stay simple.
 */

import type { CacheProvider } from '@/common/ports/cache.provider';
import type { MetricsRegistry } from '@/core/observability/metrics.registry';

export async function instrumentedGet(
  cache: CacheProvider,
  metrics: MetricsRegistry | undefined,
  key: string,
  cacheName: string,
): Promise<string | null> {
  const value = await cache.get(key);
  if (value === null) {
    metrics?.incCacheMiss(cacheName);
  } else {
    metrics?.incCacheHit(cacheName);
  }
  return value;
}
