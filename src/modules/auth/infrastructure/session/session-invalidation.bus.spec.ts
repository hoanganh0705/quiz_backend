import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';
import { SessionInvalidationBus } from './session-invalidation.bus';

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

interface CacheFake extends CacheProvider {
  store: Map<string, string>;
  ttlsByKey: Map<string, number>;
}

function makeCache(): CacheFake {
  const store = new Map<string, string>();
  const ttlsByKey = new Map<string, number>();
  return {
    store,
    ttlsByKey,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => store.delete(key)),
    getDel: jest.fn(),
    unlinkByPattern: jest.fn(),
    acquireAdvisoryLock: jest.fn(),
    releaseAdvisoryLock: jest.fn(),
    getOrSet: jest.fn(),
    getOrSetWithStampedeProtection: jest.fn(),
    rpushJson: jest.fn(async (key: string, item: unknown) => {
      const list = store.get(key);
      const raw = JSON.stringify(item);
      if (list === undefined) {
        store.set(key, raw);
        return 1;
      }
      store.set(key, `${list}\n${raw}`);
      return list.split('\n').length + 1;
    }),
    lpopJson: jest.fn(),
    lrangeJson: jest.fn(),
    trimList: jest.fn(async (key: string, start: number, stop: number) => {
      const raw = store.get(key);
      if (raw === undefined) return 0;
      const items = raw.split('\n');
      const from = start < 0 ? Math.max(items.length + start, 0) : start;
      const to = stop < 0 ? items.length + stop : Math.min(stop, items.length - 1);
      const trimmed = items.slice(from, to + 1);
      store.set(key, trimmed.join('\n'));
      return trimmed.length;
    }),
    expire: jest.fn(async (key: string, ttlSeconds: number) => {
      if (!store.has(key)) return false;
      ttlsByKey.set(key, ttlSeconds);
      return true;
    }),
    zaddByScore: jest.fn(),
    zrangeByScore: jest.fn(),
    zrem: jest.fn(),
    incrementWindowCounter: jest.fn(),
    incrementCounterWithInitialTtlSeconds: jest.fn(),
    setIfNotExistsWithTtlSeconds: jest.fn(),
  } as unknown as CacheFake;
}

function makeSessionsConfig() {
  return {
    authSessionInvalidationChannel: 'auth:session:invalidation',
  } as unknown as Parameters<typeof SessionInvalidationBus.prototype.replayRecent>[0] extends never
    ? never
    : ConstructorParameters<typeof SessionInvalidationBus>[3];
}

function makePubSub(): PubSubProvider {
  return {
    publish: jest.fn().mockResolvedValue(1),
    createSubscriber: jest.fn(() => {
      throw new Error('not used in tests');
    }),
  };
}

describe('SessionInvalidationBus.replayRecent', () => {
  it('clamps the requested limit to the replay bound', async () => {
    const cache = makeCache();
    cache.lrangeJson = jest.fn(async () => [
      { kind: 'session', identifier: 'a', emittedAtMs: 1 },
    ]) as unknown as CacheProvider['lrangeJson'];

    const bus = new SessionInvalidationBus(makePubSub(), cache, makeSessionsConfig(), makeLogger());

    await bus.replayRecent(10_000);

    expect(cache.lrangeJson).toHaveBeenCalledWith('auth:session:invalidation:replay', -100, -1);
  });

  it('returns parsed items from the cache', async () => {
    const cache = makeCache();
    const events = [
      { kind: 'session' as const, identifier: 'a', emittedAtMs: 1 },
      { kind: 'jti' as const, identifier: 'b', emittedAtMs: 2 },
    ];
    cache.lrangeJson = jest.fn(async () => events) as unknown as CacheProvider['lrangeJson'];

    const bus = new SessionInvalidationBus(makePubSub(), cache, makeSessionsConfig(), makeLogger());
    const result = await bus.replayRecent(50);

    expect(result).toEqual(events);
  });

  it('returns an empty array when the cache read fails', async () => {
    const cache = makeCache();
    cache.lrangeJson = jest.fn(async () => {
      throw new Error('redis down');
    });

    const bus = new SessionInvalidationBus(makePubSub(), cache, makeSessionsConfig(), makeLogger());
    await expect(bus.replayRecent(50)).resolves.toEqual([]);
  });
});

describe('SessionInvalidationBus.replayAndDispatch', () => {
  it('dispatches each replayed event through every registered handler', async () => {
    const cache = makeCache();
    const events = [
      { kind: 'session' as const, identifier: 's-1', emittedAtMs: 1 },
      { kind: 'jti' as const, identifier: 'j-1', emittedAtMs: 2 },
    ];
    cache.lrangeJson = jest.fn(async () => events) as unknown as CacheProvider['lrangeJson'];

    const bus = new SessionInvalidationBus(makePubSub(), cache, makeSessionsConfig(), makeLogger());
    const handler = jest.fn();
    bus.onInvalidation(handler);

    await bus.replayAndDispatch(50);

    expect(cache.lrangeJson).toHaveBeenCalledWith('auth:session:invalidation:replay', -50, -1);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, events[0]);
    expect(handler).toHaveBeenNthCalledWith(2, events[1]);
  });

  it('swallows handler errors so one bad subscriber does not stop replay', async () => {
    const cache = makeCache();
    const events = [
      { kind: 'session' as const, identifier: 's-1', emittedAtMs: 1 },
      { kind: 'jti' as const, identifier: 'j-1', emittedAtMs: 2 },
    ];
    cache.lrangeJson = jest.fn(async () => events) as unknown as CacheProvider['lrangeJson'];

    const bus = new SessionInvalidationBus(makePubSub(), cache, makeSessionsConfig(), makeLogger());
    const good = jest.fn();
    const bad = jest.fn(() => {
      throw new Error('handler boom');
    });
    bus.onInvalidation(bad);
    bus.onInvalidation(good);

    await bus.replayAndDispatch(50);

    expect(bad).toHaveBeenCalledTimes(2);
    expect(good).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when the replay list is empty', async () => {
    const cache = makeCache();
    cache.lrangeJson = jest.fn(async () => []);

    const bus = new SessionInvalidationBus(makePubSub(), cache, makeSessionsConfig(), makeLogger());
    const handler = jest.fn();
    bus.onInvalidation(handler);

    await expect(bus.replayAndDispatch(50)).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
