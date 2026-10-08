import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { RedisSocketConnectionRegistry } from './redis-socket-connection.registry';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

function makeCache(): CacheProvider {
  return {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    getDel: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(false),
  } as unknown as CacheProvider;
}

describe('RedisSocketConnectionRegistry default TTL', () => {
  it('uses a 5-minute default so healthy sockets survive transient disconnects', () => {
    const registry = new RedisSocketConnectionRegistry(makeCache(), makeLogger());
    expect(registry.getTtlMs()).toBe(5 * 60 * 1000);
  });

  it('honors the setTtlMs operator knob', () => {
    const registry = new RedisSocketConnectionRegistry(makeCache(), makeLogger());
    registry.setTtlMs(30_000);
    expect(registry.getTtlMs()).toBe(30_000);
  });

  it('rejects a non-positive TTL', () => {
    const registry = new RedisSocketConnectionRegistry(makeCache(), makeLogger());
    expect(() => registry.setTtlMs(0)).toThrow();
    expect(() => registry.setTtlMs(-1)).toThrow();
  });

  it('passes the configured TTL to cache.set on record()', async () => {
    const cache = makeCache();
    const registry = new RedisSocketConnectionRegistry(cache, makeLogger());
    await registry.record('sock-1', { instanceId: 'i-1', userId: 'u-1' });
    expect(cache.set).toHaveBeenCalledWith(
      'socket-connection:sock-1',
      expect.any(String),
      5 * 60 * 1000,
    );
  });
});
