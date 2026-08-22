/**
 * Stampede-protection cache helper.
 *
 * Re-exports `getOrSetWithStampedeProtection` from `RedisService`
 * with consistent defaults so application services don't need to
 * remember the magic numbers. The defaults (5s lock, 50ms retry
 * delay, 10 retries) match the values in `QuizCacheService` so
 * the two cache surfaces are behaviourally identical.
 *
 * Lives in its own file (instead of next to `QuizCacheService`)
 * so the user module can import the helper without pulling the
 * whole quiz module into its dependency graph.
 */

import { Inject } from '@nestjs/common';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

export const DEFAULT_STAMPEDE_LOCK_TTL_MS = 5_000;
export const DEFAULT_STAMPEDE_RETRY_DELAY_MS = 50;
export const DEFAULT_STAMPEDE_MAX_RETRIES = 10;

export const stampedeProtectedGetOrSet = async <T>(
  cache: CacheProvider,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  lockTtlMs: number = DEFAULT_STAMPEDE_LOCK_TTL_MS,
  retryDelayMs: number = DEFAULT_STAMPEDE_RETRY_DELAY_MS,
  maxRetries: number = DEFAULT_STAMPEDE_MAX_RETRIES,
): Promise<T> => {
  return cache.getOrSetWithStampedeProtection(
    key,
    ttlMs,
    fetcher,
    lockTtlMs,
    retryDelayMs,
    maxRetries,
  );
};

export const CACHE_INJECT = () => Inject(CACHE_PROVIDER);