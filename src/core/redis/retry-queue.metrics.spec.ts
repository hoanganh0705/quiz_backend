import { RetryQueueMetrics } from './retry-queue.metrics';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { RedisCircuitPort } from '@/common/ports/redis-circuit.port';

function makeService(
  opts: {
    listLength: number;
    circuitState?: 'closed' | 'open' | 'half_open';
    throwOnListLength?: boolean;
  } = { listLength: 0 },
): {
  service: RetryQueueMetrics;
  cache: { listLength: jest.Mock };
} {
  const cache = {
    listLength: jest.fn().mockImplementation(() => {
      if (opts.throwOnListLength) {
        return Promise.reject(new Error('boom'));
      }
      return Promise.resolve(opts.listLength);
    }),
  } as unknown as CacheProvider & { listLength: jest.Mock };
  const circuit = {
    getCircuitState: jest.fn().mockReturnValue(opts.circuitState ?? 'closed'),
  } as unknown as RedisCircuitPort;
  const service = new RetryQueueMetrics(cache, circuit);
  return { service, cache };
}

describe('RetryQueueMetrics', () => {
  it('returns the LLEN value when the cache answer is numeric', async () => {
    const { service } = makeService({ listLength: 42 });
    const out = await service.getDlqSize('attempt', 'tier:attempt:dlq');
    expect(out).toBe(42);
  });

  it('returns -1 when the Redis circuit is open so alerts can distinguish outage from empty', async () => {
    const { service, cache } = makeService({ listLength: 7, circuitState: 'open' });
    const out = await service.getDlqSize('coin', 'tier:coin:dlq');
    expect(out).toBe(-1);
    expect(cache.listLength).not.toHaveBeenCalled();
  });

  it('falls back to 0 when the cache returns a non-numeric value', async () => {
    const cache = {
      listLength: jest.fn().mockResolvedValue(undefined),
    } as unknown as CacheProvider & { listLength: jest.Mock };
    const circuit = {
      getCircuitState: jest.fn().mockReturnValue('closed'),
    } as unknown as RedisCircuitPort;
    const service = new RetryQueueMetrics(cache, circuit);
    const out = await service.getDlqSize('attempt', 'tier:attempt:dlq');
    expect(out).toBe(0);
  });

  it('returns -1 when the cache call throws', async () => {
    const { service } = makeService({
      listLength: 0,
      throwOnListLength: true,
    });
    const out = await service.getDlqSize('attempt', 'tier:attempt:dlq');
    expect(out).toBe(-1);
  });
});
