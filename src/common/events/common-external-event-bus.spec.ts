import { CommonExternalEventBus } from './common-external-event-bus';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';

// Defaults that mirror `resolveReplayConfig()` inside the bus module.
// The constants are not exported, so we hard-code the documented defaults
// here. If you change them, update these values too.
const DEFAULT_BUCKET_SECONDS = 1;
const DEFAULT_BUCKET_COUNT = 60;
const DEFAULT_BUCKET_PREFIX = 'external:xp:replay';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makePubSub(): PubSubProvider {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    createSubscriber: jest.fn(),
  };
}

function makeCache(): CacheProvider {
  return {
    rpushJson: jest.fn().mockResolvedValue(1),
    trimList: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(true),
    lrangeJson: jest.fn().mockResolvedValue([]),
  } as unknown as CacheProvider;
}

const baseEvent = {
  eventType: 'external.xp.earned' as const,
  userId: 'u-1',
  amount: 10,
  source: 'tournament' as const,
  tournamentId: 't-1',
  timestamp: new Date(),
};

describe('CommonExternalEventBus.publishXpEarned (mandatory idempotencyKey)', () => {
  it('throws when idempotencyKey is missing', async () => {
    const bus = new CommonExternalEventBus(makePubSub(), makeCache(), makeLogger());

    await expect(
      // @ts-expect-error -- intentionally omitting the now-required key
      bus.publishXpEarned({ ...baseEvent }),
    ).rejects.toThrow(/idempotencyKey is required/);
  });

  it('throws when idempotencyKey is empty string', async () => {
    const bus = new CommonExternalEventBus(makePubSub(), makeCache(), makeLogger());

    await expect(bus.publishXpEarned({ ...baseEvent, idempotencyKey: '' })).rejects.toThrow(
      /idempotencyKey is required/,
    );
  });

  it('publishes when idempotencyKey is supplied', async () => {
    const pubSub = makePubSub();
    const bus = new CommonExternalEventBus(pubSub, makeCache(), makeLogger());

    await bus.publishXpEarned({ ...baseEvent, idempotencyKey: 't-1:u-1:1' });

    expect(pubSub.publish as jest.Mock).toHaveBeenCalledTimes(1);
  });
});

describe('CommonExternalEventBus.replayAndDispatch', () => {
  it('dispatches each replayed event through every registered handler', async () => {
    const eventsByBucket: Record<string, unknown[]> = {};
    const base = Math.floor(Date.now() / 1000 / DEFAULT_BUCKET_SECONDS);
    const bucketKeys = Array.from({ length: DEFAULT_BUCKET_COUNT }, (_, i) => {
      const seconds = (base - DEFAULT_BUCKET_COUNT + 1 + i) * DEFAULT_BUCKET_SECONDS;
      return `${DEFAULT_BUCKET_PREFIX}:${seconds}`;
    });
    const targetKey = bucketKeys[Math.floor(bucketKeys.length / 2)];
    const targetKeyLate = bucketKeys[bucketKeys.length - 1];
    eventsByBucket[targetKey] = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u-1',
        amount: 10,
        source: 'tournament' as const,
        tournamentId: 't-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        idempotencyKey: 't-1:u-1:1',
      },
    ];
    eventsByBucket[targetKeyLate] = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u-2',
        amount: 20,
        source: 'quiz_attempt' as const,
        timestamp: '2026-01-01T00:00:01.000Z',
        idempotencyKey: 'xp:u-2:attempt:a-1',
      },
    ];

    const lrangeCalls: string[] = [];
    const cache = {
      ...makeCache(),
      lrangeJson: jest.fn().mockImplementation((key: string) => {
        lrangeCalls.push(key);
        return Promise.resolve(eventsByBucket[key] ?? []);
      }),
    } as unknown as CacheProvider;

    const bus = new CommonExternalEventBus(makePubSub(), cache, makeLogger());
    const handler = jest.fn();
    bus.subscribe('external.xp.earned', handler);

    await bus.replayAndDispatch();

    expect(lrangeCalls).toHaveLength(DEFAULT_BUCKET_COUNT);
    expect(lrangeCalls.every((k) => k.startsWith(`${DEFAULT_BUCKET_PREFIX}:`))).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('scans only the trailing replay buckets', async () => {
    const seenKeys: string[] = [];
    const cache = {
      ...makeCache(),
      lrangeJson: jest.fn().mockImplementation((key: string) => {
        seenKeys.push(key);
        return Promise.resolve([]);
      }),
    } as unknown as CacheProvider;

    const bus = new CommonExternalEventBus(makePubSub(), cache, makeLogger());
    await bus.replayAndDispatch();

    expect(seenKeys).toHaveLength(DEFAULT_BUCKET_COUNT);
    const lastKeySeconds = Number(seenKeys[seenKeys.length - 1].split(':').pop());
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(lastKeySeconds).toBeLessThanOrEqual(nowSeconds);
  });

  it('skips a bucket whose read throws and keeps going', async () => {
    const cache = {
      ...makeCache(),
      lrangeJson: jest
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('redis blip')))
        .mockImplementation(() => Promise.resolve([])),
    } as unknown as CacheProvider;

    const bus = new CommonExternalEventBus(makePubSub(), cache, makeLogger());
    await expect(bus.replayAndDispatch()).resolves.toBeUndefined();
  });

  it('reads all replay buckets in parallel', async () => {
    const bucketKeys = Array.from({ length: DEFAULT_BUCKET_COUNT }, (_, i) => {
      const seconds =
        (Math.floor(Date.now() / 1000 / DEFAULT_BUCKET_SECONDS) - DEFAULT_BUCKET_COUNT + 1 + i) *
        DEFAULT_BUCKET_SECONDS;
      return `${DEFAULT_BUCKET_PREFIX}:${seconds}`;
    });
    const eventsByBucket: Record<string, unknown[]> = {};
    eventsByBucket[bucketKeys[0]] = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u-1',
        amount: 10,
        source: 'tournament' as const,
        tournamentId: 't-1',
        timestamp: '2026-01-01T00:00:00.000Z',
        idempotencyKey: 't-1:u-1:1',
      },
    ];

    const lrangeCalls: string[] = [];
    const cache = {
      ...makeCache(),
      lrangeJson: jest.fn().mockImplementation((key: string) => {
        lrangeCalls.push(key);
        return Promise.resolve(eventsByBucket[key] ?? []);
      }),
    } as unknown as CacheProvider;

    const bus = new CommonExternalEventBus(makePubSub(), cache, makeLogger());
    const handler = jest.fn();
    bus.subscribe('external.xp.earned', handler);

    const start = Date.now();
    await bus.replayAndDispatch();
    const elapsed = Date.now() - start;

    expect(lrangeCalls).toHaveLength(DEFAULT_BUCKET_COUNT);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(500);
  });

  it('is a no-op when the cache is not wired', async () => {
    const bus = new CommonExternalEventBus(makePubSub(), undefined, makeLogger());
    const handler = jest.fn();
    bus.subscribe('external.xp.earned', handler);

    await expect(bus.replayAndDispatch()).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('is a no-op when the replay list is empty', async () => {
    const cache = {
      ...makeCache(),
      lrangeJson: jest.fn().mockResolvedValue([]),
    } as unknown as CacheProvider;
    const bus = new CommonExternalEventBus(makePubSub(), cache, makeLogger());
    const handler = jest.fn();
    bus.subscribe('external.xp.earned', handler);

    await expect(bus.replayAndDispatch()).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
