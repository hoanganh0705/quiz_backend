import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { SocialCacheService } from './social-cache.service';
import type {
  SocialDomainEventBusPort,
  SocialDomainEvent,
} from '../../domain/events/social-event-bus.port';

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

interface BusFake extends SocialDomainEventBusPort {
  handlers: Array<(event: SocialDomainEvent) => void>;
}

function makeBus(): BusFake {
  const handlers: Array<(event: SocialDomainEvent) => void> = [];
  const bus: BusFake = {
    handlers,
    subscribe: (handler) => {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
    emitFriendRequestSent: jest.fn(),
    emitFriendRequestAccepted: jest.fn(),
    emitFriendRequestRejected: jest.fn(),
    emitFriendRequestCancelled: jest.fn(),
    emitFriendRemoved: jest.fn(),
    emitUserBlocked: jest.fn(),
    emitUserUnblocked: jest.fn(),
    emitUserFollowed: jest.fn(),
    emitUserUnfollowed: jest.fn(),
  };
  return bus;
}

function makeCache(): CacheProvider {
  const store = new Map<string, string>();
  return {
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
    rpushJson: jest.fn(),
    lpopJson: jest.fn(),
    lrangeJson: jest.fn(),
    trimList: jest.fn(),
    expire: jest.fn(),
    zaddByScore: jest.fn(),
    zrangeByScore: jest.fn(),
    zrem: jest.fn(),
    incrementWindowCounter: jest.fn(),
    incrementCounterWithInitialTtlSeconds: jest.fn(),
    setIfNotExistsWithTtlSeconds: jest.fn(),
    listLength: jest.fn(),
    pipelineDeadLetterPush: jest.fn(),
  } as unknown as CacheProvider;
}

describe('SocialCacheService — domain-event invalidation', () => {
  it('subscribes to the social event bus on init', () => {
    const bus = makeBus();
    new SocialCacheService(makeCache(), makeLogger(), bus).onModuleInit();
    expect(bus.handlers).toHaveLength(1);
  });

  it('invalidates the cache for both users on user_blocked', async () => {
    const bus = makeBus();
    const cache = makeCache();
    void (cache.store as unknown);
    const service = new SocialCacheService(cache, makeLogger(), bus);
    service.onModuleInit();

    bus.handlers[0]({
      eventType: 'user_blocked',
      blockerId: 'u1',
      blockedId: 'u2',
      reason: null,
      timestamp: new Date(),
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect((cache.del as jest.Mock).mock.calls.map(([key]) => key)).toEqual(
      expect.arrayContaining(['social:counts:u1', 'social:counts:u2']),
    );
  });

  it('invalidates the cache for both users on user_followed', async () => {
    const bus = makeBus();
    const cache = makeCache();
    const service = new SocialCacheService(cache, makeLogger(), bus);
    service.onModuleInit();

    bus.handlers[0]({
      eventType: 'user_followed',
      followId: 'f1',
      followerId: 'u1',
      followerUsername: 'a',
      followingId: 'u2',
      followingUsername: 'b',
      timestamp: new Date(),
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect((cache.del as jest.Mock).mock.calls.map(([key]) => key)).toEqual(
      expect.arrayContaining(['social:counts:u1', 'social:counts:u2']),
    );
  });

  it('invalidates the cache for both users on friend_removed', async () => {
    const bus = makeBus();
    const cache = makeCache();
    const service = new SocialCacheService(cache, makeLogger(), bus);
    service.onModuleInit();

    bus.handlers[0]({
      eventType: 'friend_removed',
      userId: 'u1',
      friendId: 'u2',
      timestamp: new Date(),
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect((cache.del as jest.Mock).mock.calls.map(([key]) => key)).toEqual(
      expect.arrayContaining(['social:counts:u1', 'social:counts:u2']),
    );
  });

  it('still works when no event bus is provided', async () => {
    const cache = makeCache();
    const service = new SocialCacheService(cache, makeLogger());
    expect(() => service.onModuleInit()).not.toThrow();
    expect(() => service.onModuleDestroy()).not.toThrow();
    await expect(service.invalidateCounts('u1')).resolves.toBeUndefined();
  });

  it('continues to function when event-driven invalidation throws', async () => {
    const bus = makeBus();
    const cache = makeCache();
    (cache.del as jest.Mock).mockRejectedValueOnce(new Error('redis down'));

    const service = new SocialCacheService(cache, makeLogger(), bus);
    service.onModuleInit();

    expect(() =>
      bus.handlers[0]({
        eventType: 'user_blocked',
        blockerId: 'u1',
        blockedId: 'u2',
        reason: null,
        timestamp: new Date(),
      }),
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
  });
});
