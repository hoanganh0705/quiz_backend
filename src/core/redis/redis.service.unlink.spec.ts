import { RedisService } from './redis.service';
import { RedisCircuitBreaker } from './redis-circuit-breaker';
import type { CacheProvider } from '@/common/ports/cache.provider';

class FakeBreaker extends RedisCircuitBreaker {
  constructor() {
    super({ failureThreshold: 100, resetTimeoutMs: 1000 });
  }
  override async exec<T>(fallback: T, task: () => Promise<T>): Promise<T> {
    return task();
  }
}

interface RedisFake {
  client: {
    scan: jest.Mock;
    unlink: jest.Mock;
    eval: jest.Mock;
  };
}

function makeServiceWithClient(): { service: RedisService; redis: RedisFake } {
  const redis: RedisFake = {
    client: {
      scan: jest.fn(),
      unlink: jest.fn(),
      eval: jest.fn(),
    },
  };

  const service = new RedisService(
    { url: 'redis://localhost:6379' } as never,
    { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never,
    new FakeBreaker(),
  );
  (service as unknown as { client: RedisFake['client'] }).client = redis.client;

  return { service, redis };
}

describe('RedisService.unlinkByPattern', () => {
  it('returns 0 when no keys match the pattern', async () => {
    const { service, redis } = makeServiceWithClient();
    redis.client.scan.mockResolvedValueOnce(['0', []]);
    await expect(service.unlinkByPattern('quiz:list:v1:*')).resolves.toBe(0);
    expect(redis.client.unlink).not.toHaveBeenCalled();
  });

  it('unlinks every matching key and finishes the cursor', async () => {
    const { service, redis } = makeServiceWithClient();
    redis.client.scan
      .mockResolvedValueOnce(['7', ['quiz:list:v1:a', 'quiz:list:v1:b']])
      .mockResolvedValueOnce(['0', ['quiz:list:v1:c']]);
    redis.client.unlink.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const count = await service.unlinkByPattern('quiz:list:v1:*');

    expect(count).toBe(3);
    expect(redis.client.scan).toHaveBeenCalledTimes(2);
    expect(redis.client.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'quiz:list:v1:*',
      'COUNT',
      100,
    );
    expect(redis.client.scan).toHaveBeenNthCalledWith(
      2,
      '7',
      'MATCH',
      'quiz:list:v1:*',
      'COUNT',
      100,
    );
    expect(redis.client.unlink).toHaveBeenCalledTimes(2);
    expect(redis.client.unlink).toHaveBeenNthCalledWith(1, 'quiz:list:v1:a', 'quiz:list:v1:b');
    expect(redis.client.unlink).toHaveBeenNthCalledWith(2, 'quiz:list:v1:c');
  });

  it('respects a custom batch size', async () => {
    const { service, redis } = makeServiceWithClient();
    redis.client.scan.mockResolvedValueOnce(['0', ['quiz:list:v1:x']]);
    redis.client.unlink.mockResolvedValueOnce(1);

    await service.unlinkByPattern('quiz:list:v1:*', 250);

    expect(redis.client.scan).toHaveBeenCalledWith('0', 'MATCH', 'quiz:list:v1:*', 'COUNT', 250);
  });

  it('swallows the unlink count returned as 0 (treated as 0 deleted)', async () => {
    const { service, redis } = makeServiceWithClient();
    redis.client.scan.mockResolvedValueOnce(['0', ['quiz:list:v1:gone']]);
    redis.client.unlink.mockResolvedValueOnce(0);

    await expect(service.unlinkByPattern('quiz:list:v1:*')).resolves.toBe(0);
  });
});

describe('CacheProvider contract surface', () => {
  it('exposes unlinkByPattern', () => {
    const { service } = makeServiceWithClient();
    const cache: CacheProvider = service;
    expect(typeof cache.unlinkByPattern).toBe('function');
  });
});
