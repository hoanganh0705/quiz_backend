import { SharedAchievementEventBusAdapter } from './shared-achievement-event-bus.adapter';
import type { AchievementDomainEventBus } from './achievement-domain.event-bus';

function makeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeInternalBus(): AchievementDomainEventBus & {
  subscribeAll: jest.Mock;
} {
  const subscribeAll = jest.fn(() => ({ unsubscribe: jest.fn() }));
  return { subscribeAll } as unknown as AchievementDomainEventBus & { subscribeAll: jest.Mock };
}

type CacheMock = {
  setIfNotExistsWithTtlSeconds: jest.Mock<Promise<boolean>, [string, string, number]>;
};

type ThrowingCacheMock = {
  setIfNotExistsWithTtlSeconds: jest.Mock<Promise<never>, [string, string, number]>;
};

function makeCache(setIfNotExistsResult: boolean): CacheMock {
  const mock = jest.fn<Promise<boolean>, [string, string, number]>(
    (_key: string, _value: string, _ttl: number) => Promise.resolve(setIfNotExistsResult),
  );
  return { setIfNotExistsWithTtlSeconds: mock };
}

function makeCacheThatThrows(): ThrowingCacheMock {
  const mock = jest.fn<Promise<never>, [string, string, number]>(
    (_key: string, _value: string, _ttl: number) => Promise.reject(new Error('redis down')),
  );
  return { setIfNotExistsWithTtlSeconds: mock };
}

const baseBadgeEarned = {
  eventType: 'badge.earned' as const,
  userId: 'u-1',
  badgeType: 'first-quiz',
  awardedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const baseAchievementAwarded = {
  eventType: 'achievement.awarded' as const,
  userId: 'u-1',
  achievementType: 'quiz',
  badgeType: 'first-quiz',
  period: 'weekly',
  rank: 1,
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
};

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

async function publishThrough(
  adapter: SharedAchievementEventBusAdapter,
  event: unknown,
): Promise<void> {
  const publish = (
    adapter as unknown as {
      forwardToSharedBus(this: void, e: unknown): Promise<void>;
    }
  ).forwardToSharedBus;
  await publish.call(adapter, event);
}

describe('SharedAchievementEventBusAdapter', () => {
  it('wires subscribeAll on init and tears it down on destroy', () => {
    const bus = makeInternalBus();
    const adapter = new SharedAchievementEventBusAdapter(bus, makeLogger(), null);
    adapter.onModuleInit();
    expect(bus.subscribeAll).toHaveBeenCalledTimes(1);

    adapter.onModuleDestroy();
  });

  it('dispatches a translated event to every subscribed shared handler', async () => {
    const adapter = new SharedAchievementEventBusAdapter(makeInternalBus(), makeLogger(), null);
    const handler = jest.fn();
    adapter.subscribe(handler);

    await publishThrough(adapter, baseBadgeEarned);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(baseBadgeEarned);
  });

  it('skips the dispatch when an earlier publish already claimed the slot', async () => {
    const cache = makeCache(false);
    const adapter = new SharedAchievementEventBusAdapter(
      makeInternalBus(),
      makeLogger(),
      cache as never,
    );
    const handler = jest.fn();
    adapter.subscribe(handler);

    await publishThrough(adapter, baseAchievementAwarded);
    await flushPromises();

    expect(handler).not.toHaveBeenCalled();
    expect(cache.setIfNotExistsWithTtlSeconds).toHaveBeenCalledWith(
      'shared:achievement:fanout:achievement.awarded:u-1',
      '1',
      30,
    );
  });

  it('fails open when the cache throws', async () => {
    const cache = makeCacheThatThrows();
    const adapter = new SharedAchievementEventBusAdapter(
      makeInternalBus(),
      makeLogger(),
      cache as never,
    );
    const handler = jest.fn();
    adapter.subscribe(handler);

    await publishThrough(adapter, baseBadgeEarned);
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not consult the cache when the translated event lacks a userId', async () => {
    const cache = makeCache(true);
    const adapter = new SharedAchievementEventBusAdapter(
      makeInternalBus(),
      makeLogger(),
      cache as never,
    );
    const handler = jest.fn();
    adapter.subscribe(handler);

    await publishThrough(adapter, {
      ...baseBadgeEarned,
      userId: undefined,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(cache.setIfNotExistsWithTtlSeconds).not.toHaveBeenCalled();
  });

  it('swallows handler errors and continues dispatching the remaining handlers', async () => {
    const adapter = new SharedAchievementEventBusAdapter(makeInternalBus(), makeLogger(), null);
    const second = jest.fn();
    adapter.subscribe(() => {
      throw new Error('boom');
    });
    adapter.subscribe(second);

    await publishThrough(adapter, baseBadgeEarned);

    expect(second).toHaveBeenCalledTimes(1);
  });
});
