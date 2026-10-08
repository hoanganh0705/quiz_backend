import type { PinoLogger } from 'nestjs-pino';
import { BookmarkQueryService } from './bookmark-query.service';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './events/bookmark-domain.events';
import type { BookmarkRepositoryPort } from './ports/bookmark-repository.port';
import type { BookmarkCollectionRepositoryPort } from './ports/bookmark-collection-repository.port';
import type { BookmarkDomainEventBusPort } from './events/bookmark-domain-event-bus.port';
import type { CacheProvider } from '@/common/ports/cache.provider';
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

interface Store {
  store: Map<string, string>;
  get: jest.Mock;
  set: jest.Mock;
  unlinkByPattern: jest.Mock;
}

function makeStore(): Store {
  const store = new Map<string, string>();
  const fallback = {
    del: jest.fn(async () => true),
    getDel: jest.fn(),
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
  };
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    unlinkByPattern: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace(/:[^:]*$/, '');
      const deleted = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
      for (const key of deleted) store.delete(key);
      return deleted.length;
    }),
    ...fallback,
  };
}

const user: JwtPayload = {
  sub: 'user-1',
  role: 'user',
  email: 'a@b.c',
  username: 'u',
} as JwtPayload;

const analytics: BookmarkCollectionAnalytics = {
  collectionId: 'col-1',
  totalBookmarks: 3,
  uniqueQuizzes: 3,
  lastBookmarkAt: '2026-01-01T00:00:00.000Z',
};

function makeService(opts: {
  store: Store;
  repository?: Partial<BookmarkRepositoryPort>;
  collection?: Partial<BookmarkCollectionRepositoryPort>;
  bus?: BookmarkDomainEventBusPort;
}) {
  const collectionRepo = {
    getCollectionById: jest.fn(async (id: string) =>
      id === 'col-1' ? { collectionId: 'col-1', userId: 'user-1' } : null,
    ),
    ...opts.collection,
  } as unknown as BookmarkCollectionRepositoryPort;

  const bookmarkRepo = {
    getCollectionAnalytics: jest.fn(async () => analytics),
    ...opts.repository,
  } as unknown as BookmarkRepositoryPort;

  const service = new BookmarkQueryService(
    bookmarkRepo,
    collectionRepo,
    opts.store as unknown as CacheProvider,
    makeLogger(),
    opts.bus,
  );
  if (opts.bus) service.onModuleInit();

  return { service, bookmarkRepo, collectionRepo };
}

describe('BookmarkQueryService.getCollectionAnalytics — cache hit / miss / invalidation triplet', () => {
  it('cache miss → repository → cache write', async () => {
    const store = makeStore();
    const { service, bookmarkRepo } = makeService({ store });
    store.get.mockResolvedValueOnce(null);

    const result = await service.getCollectionAnalytics('col-1', user);

    expect(result).toEqual(analytics);
    expect(bookmarkRepo.getCollectionAnalytics).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith(
      'bookmark:collection:col-1:analytics:user:user-1',
      JSON.stringify(analytics),
      expect.any(Number),
    );
  });

  it('cache hit → returns cached value without hitting the repository', async () => {
    const store = makeStore();
    const cached = JSON.stringify({ ...analytics, totalBookmarks: 99 });
    store.store.set('bookmark:collection:col-1:analytics:user:user-1', cached);
    const { service, bookmarkRepo } = makeService({ store });

    const result = await service.getCollectionAnalytics('col-1', user);

    expect(result.totalBookmarks).toBe(99);
    expect(bookmarkRepo.getCollectionAnalytics).not.toHaveBeenCalled();
  });

  it('invalidation on bookmark add removes the cache pattern → next read repopulates', async () => {
    const handlers: Array<(event: unknown) => void> = [];
    const bus: BookmarkDomainEventBusPort = {
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
    const store = makeStore();
    const { service, bookmarkRepo } = makeService({ store, bus });
    store.store.set(
      'bookmark:collection:col-1:analytics:user:user-1',
      JSON.stringify({ ...analytics, totalBookmarks: 1 }),
    );
    bookmarkRepo.getCollectionAnalytics = jest
      .fn()
      .mockResolvedValueOnce({ ...analytics, totalBookmarks: 7 });

    expect(handlers).toHaveLength(1);
    handlers[0](
      new BookmarkAddedEvent('b-1', 'col-1', 'quiz-1', 'user-1', '2026-01-01T00:00:00.000Z'),
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(store.unlinkByPattern).toHaveBeenCalledWith('bookmark:collection:col-1:analytics:*');
    expect(store.store.has('bookmark:collection:col-1:analytics:user:user-1')).toBe(false);

    const result = await service.getCollectionAnalytics('col-1', user);

    expect(bookmarkRepo.getCollectionAnalytics).toHaveBeenCalledTimes(1);
    expect(result.totalBookmarks).toBe(7);
  });

  it('BookmarkRemovedEvent also invalidates the cache', async () => {
    const handlers: Array<(event: unknown) => void> = [];
    const bus: BookmarkDomainEventBusPort = {
      subscribe: (handler) => {
        handlers.push(handler);
        return () => undefined;
      },
      emitBookmarkAdded: jest.fn(),
      emitBookmarkRemoved: jest.fn(),
    };
    const store = makeStore();
    const { service, bookmarkRepo } = makeService({ store, bus });
    store.store.set('bookmark:collection:col-1:analytics:user:user-1', JSON.stringify(analytics));
    bookmarkRepo.getCollectionAnalytics = jest
      .fn()
      .mockResolvedValueOnce({ ...analytics, uniqueQuizzes: 99 });

    handlers[0](
      new BookmarkRemovedEvent('b-1', 'col-1', 'quiz-1', 'user-1', '2026-01-01T00:00:00.000Z'),
    );

    await new Promise((resolve) => setImmediate(resolve));
    await service.getCollectionAnalytics('col-1', user);

    expect(bookmarkRepo.getCollectionAnalytics).toHaveBeenCalledTimes(1);
  });
});
