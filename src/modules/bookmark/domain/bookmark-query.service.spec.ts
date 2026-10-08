import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { BookmarkQueryService } from './bookmark-query.service';
import type { BookmarkRepositoryPort } from './ports/bookmark-repository.port';
import type { BookmarkCollectionRepositoryPort } from './ports/bookmark-collection-repository.port';
import type { BookmarkDomainEventBusPort } from './events/bookmark-domain-event-bus.port';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './events/bookmark-domain.events';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { BookmarkCollectionAnalytics } from './types/bookmark-collection-analytics';

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

interface BusFake extends BookmarkDomainEventBusPort {
  handlers: Array<(event: unknown) => void>;
}

function makeBus(): BusFake {
  const handlers: Array<(event: unknown) => void> = [];
  const bus: BusFake = {
    handlers,
    subscribe: (handler) => {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
    emitBookmarkAdded: jest.fn(),
    emitBookmarkRemoved: jest.fn(),
  };
  return bus;
}

function makeCache(): CacheProvider {
  return {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => true),
    getDel: jest.fn(),
    unlinkByPattern: jest.fn(async () => 0),
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
  } as unknown as CacheProvider;
}

function makeBookmarkRepo(): BookmarkRepositoryPort {
  return {} as unknown as BookmarkRepositoryPort;
}

function makeCollectionRepo(): BookmarkCollectionRepositoryPort {
  return {
    getCollectionById: jest.fn(async (id: string) =>
      id === 'col-1' ? { collectionId: 'col-1', userId: 'user-1' } : null,
    ),
  } as unknown as BookmarkCollectionRepositoryPort;
}

const user: JwtPayload = {
  sub: 'user-1',
  role: 'user',
  email: 'a@b.c',
  username: 'u',
} as JwtPayload;

describe('BookmarkQueryService — analytics cache invalidation', () => {
  it('subscribes to the bookmark event bus on init', () => {
    const bus = makeBus();
    new BookmarkQueryService(
      makeBookmarkRepo(),
      makeCollectionRepo(),
      makeCache(),
      makeLogger(),
      bus,
    ).onModuleInit();
    expect(bus.handlers).toHaveLength(1);
  });

  it('wipes the collection analytics pattern when a bookmark is added', async () => {
    const bus = makeBus();
    const cache = makeCache();
    const service = new BookmarkQueryService(
      makeBookmarkRepo(),
      makeCollectionRepo(),
      cache,
      makeLogger(),
      bus,
    );
    service.onModuleInit();

    bus.handlers[0](
      new BookmarkAddedEvent('bookmark-1', 'col-1', 'quiz-1', 'user-1', '2026-01-01T00:00:00.000Z'),
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(cache.unlinkByPattern).toHaveBeenCalledWith('bookmark:collection:col-1:analytics:*');
  });

  it('wipes the collection analytics pattern when a bookmark is removed', async () => {
    const bus = makeBus();
    const cache = makeCache();
    const service = new BookmarkQueryService(
      makeBookmarkRepo(),
      makeCollectionRepo(),
      cache,
      makeLogger(),
      bus,
    );
    service.onModuleInit();

    bus.handlers[0](
      new BookmarkRemovedEvent(
        'bookmark-1',
        'col-1',
        'quiz-1',
        'user-1',
        '2026-01-01T00:00:00.000Z',
      ),
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(cache.unlinkByPattern).toHaveBeenCalledWith('bookmark:collection:col-1:analytics:*');
  });

  it('does not subscribe when no event bus is provided', () => {
    const cache = makeCache();
    const service = new BookmarkQueryService(
      makeBookmarkRepo(),
      makeCollectionRepo(),
      cache,
      makeLogger(),
    );
    expect(() => service.onModuleInit()).not.toThrow();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });

  it('keeps working when the unlink fails', async () => {
    const bus = makeBus();
    const cache = makeCache();
    (cache.unlinkByPattern as jest.Mock).mockRejectedValueOnce(new Error('redis down'));

    const service = new BookmarkQueryService(
      makeBookmarkRepo(),
      makeCollectionRepo(),
      cache,
      makeLogger(),
      bus,
    );
    service.onModuleInit();

    expect(() =>
      bus.handlers[0](
        new BookmarkAddedEvent(
          'bookmark-1',
          'col-1',
          'quiz-1',
          'user-1',
          '2026-01-01T00:00:00.000Z',
        ),
      ),
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
  });

  it('read-through path uses the per-tenant cache key (no cross-tenant leakage)', async () => {
    const cache = makeCache();
    const collectionRepo = makeCollectionRepo();
    const analytics: BookmarkCollectionAnalytics = {
      collectionId: 'col-1',
      totalBookmarks: 3,
      uniqueQuizzes: 3,
      lastBookmarkAt: '2026-01-01T00:00:00.000Z',
    };
    const bookmarkRepo = {
      getCollectionAnalytics: jest.fn(async () => analytics),
    } as unknown as BookmarkRepositoryPort;

    const service = new BookmarkQueryService(bookmarkRepo, collectionRepo, cache, makeLogger());

    await service.getCollectionAnalytics('col-1', user);

    expect(cache.set).toHaveBeenCalledWith(
      'bookmark:collection:col-1:analytics:user:user-1',
      JSON.stringify(analytics),
      expect.any(Number),
    );
  });
});
