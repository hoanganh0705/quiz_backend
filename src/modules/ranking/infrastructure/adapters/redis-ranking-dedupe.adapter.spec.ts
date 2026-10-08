import { RedisRankingDedupeAdapter } from './redis-ranking-dedupe.adapter';
import { CircuitOpenError } from '@/common/resilience/circuit-breaker';

class TestLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

const makeCacheFake = () => ({
  setIfNotExistsWithTtlSeconds: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
});

const makeAdapter = (cache: ReturnType<typeof makeCacheFake> = makeCacheFake()) => {
  const logger = new TestLogger();
  const adapter = new RedisRankingDedupeAdapter(
    cache as unknown as never,
    logger as unknown as never,
  );
  return { adapter, logger, cache };
};

describe('RedisRankingDedupeAdapter', () => {
  describe('tryClaimXp', () => {
    it('returns true when SET NX succeeds (key was absent)', async () => {
      const { adapter } = makeAdapter(makeCacheFake());
      const claimed = await adapter.tryClaimXp('xp:user:attempt:abc', 60);
      expect(claimed).toBe(true);
    });

    it('returns false when SET NX reports the key already exists', async () => {
      const cache = makeCacheFake();
      cache.setIfNotExistsWithTtlSeconds.mockResolvedValue(false);
      const { adapter } = makeAdapter(cache);
      const claimed = await adapter.tryClaimXp('xp:user:attempt:abc', 60);
      expect(claimed).toBe(false);
    });

    it('prefixes the key with xp:processed:', async () => {
      const cache = makeCacheFake();
      const { adapter } = makeAdapter(cache);
      await adapter.tryClaimXp('xp:user:attempt:abc', 60);
      expect(cache.setIfNotExistsWithTtlSeconds).toHaveBeenCalledWith(
        'xp:processed:xp:user:attempt:abc',
        '1',
        60,
      );
    });

    it('fails open when Redis raises CircuitOpenError', async () => {
      const cache = makeCacheFake();
      cache.setIfNotExistsWithTtlSeconds.mockRejectedValue(new CircuitOpenError('open', 'open'));
      const { adapter, logger } = makeAdapter(cache);
      const claimed = await adapter.tryClaimXp('xp:user:attempt:abc', 60);
      expect(claimed).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ranking_dedupe_fail_open',
          idempotencyKey: 'xp:user:attempt:abc',
          reason: 'redis_circuit_open',
        }),
      );
    });

    it('fails open when Redis raises any other error', async () => {
      const cache = makeCacheFake();
      cache.setIfNotExistsWithTtlSeconds.mockRejectedValue(new Error('connection refused'));
      const { adapter, logger } = makeAdapter(cache);
      const claimed = await adapter.tryClaimXp('xp:user:attempt:abc', 60);
      expect(claimed).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ranking_dedupe_fail_open',
        }),
      );
    });

    it('rejects a non-positive ttlSeconds with a clear error', async () => {
      const { adapter } = makeAdapter();
      await expect(adapter.tryClaimXp('xp:user:attempt:abc', 0)).rejects.toThrow(
        'ttlSeconds must be a positive integer',
      );
      await expect(adapter.tryClaimXp('xp:user:attempt:abc', -1)).rejects.toThrow(
        'ttlSeconds must be a positive integer',
      );
      await expect(adapter.tryClaimXp('xp:user:attempt:abc', 1.5)).rejects.toThrow(
        'ttlSeconds must be a positive integer',
      );
    });
  });

  describe('releaseXp', () => {
    it('removes the prefixed key', async () => {
      const cache = makeCacheFake();
      const { adapter } = makeAdapter(cache);
      await adapter.releaseXp('xp:user:attempt:abc');
      expect(cache.del).toHaveBeenCalledWith('xp:processed:xp:user:attempt:abc');
    });

    it('logs a warning when DEL fails and never throws', async () => {
      const cache = makeCacheFake();
      cache.del.mockRejectedValue(new Error('boom'));
      const { adapter, logger } = makeAdapter(cache);
      await expect(adapter.releaseXp('xp:user:attempt:abc')).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ranking_dedupe_release_failed',
        }),
      );
    });
  });
});
