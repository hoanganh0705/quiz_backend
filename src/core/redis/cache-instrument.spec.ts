import { instrumentedGet } from './cache-instrument';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { MetricsRegistry } from '@/core/observability/metrics.registry';

function makeCache(value: string | null): CacheProvider {
  return {
    get: jest.fn().mockResolvedValue(value),
  } as unknown as CacheProvider;
}

function makeMetrics(): MetricsRegistry {
  return {
    incCacheHit: jest.fn(),
    incCacheMiss: jest.fn(),
  } as unknown as MetricsRegistry;
}

describe('instrumentedGet', () => {
  it('records a hit and returns the value', async () => {
    const cache = makeCache('payload');
    const metrics = makeMetrics();

    const result = await instrumentedGet(cache, metrics, 'key-1', 'unit-test');

    expect(result).toBe('payload');
    expect(metrics.incCacheHit).toHaveBeenCalledWith('unit-test');
    expect(metrics.incCacheMiss).not.toHaveBeenCalled();
  });

  it('records a miss and returns null', async () => {
    const cache = makeCache(null);
    const metrics = makeMetrics();

    const result = await instrumentedGet(cache, metrics, 'key-1', 'unit-test');

    expect(result).toBeNull();
    expect(metrics.incCacheMiss).toHaveBeenCalledWith('unit-test');
    expect(metrics.incCacheHit).not.toHaveBeenCalled();
  });

  it('does not throw when metrics is undefined', async () => {
    const cache = makeCache(null);
    await expect(instrumentedGet(cache, undefined, 'k', 'unit-test')).resolves.toBeNull();
  });
});
