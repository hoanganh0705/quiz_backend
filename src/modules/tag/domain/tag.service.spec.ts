import type { PinoLogger } from 'nestjs-pino';
import { TagDomainService } from './tag.service';
import type { TagRepositoryPort } from './ports';
import type { TagFollowRepositoryPort } from './ports';
import type { TagRankingRepositoryPort } from './ports';
import type { RedisService } from '@/core/redis/redis.service';
import type { TagDomainEventBusPort } from './events/tag-domain-event-bus.port';
import type { TagRow } from './ports';
import type { CreateTagCommand, UpdateTagCommand } from './types/tag-commands';

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

function makeCache(): Pick<
  RedisService,
  'get' | 'set' | 'getOrSetWithStampedeProtection' | 'incrementCounterWithInitialTtlSeconds'
> {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getOrSetWithStampedeProtection: jest.fn(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    ),
    incrementCounterWithInitialTtlSeconds: jest.fn().mockResolvedValue(1),
  };
}

interface BusFake extends TagDomainEventBusPort {
  emitTagCreated: jest.Mock;
  emitTagUpdated: jest.Mock;
  emitTagDeleted: jest.Mock;
  emitTagRestored: jest.Mock;
  emitTagFollowed: jest.Mock;
  emitTagUnfollowed: jest.Mock;
}

function makeBus(): BusFake {
  return {
    emitTagCreated: jest.fn(),
    emitTagUpdated: jest.fn(),
    emitTagDeleted: jest.fn(),
    emitTagRestored: jest.fn(),
    emitTagFollowed: jest.fn(),
    emitTagUnfollowed: jest.fn(),
  };
}

function _makeService(
  opts: {
    tagRepository?: Partial<TagRepositoryPort>;
    tagRankingRepository?: Partial<TagRankingRepositoryPort>;
    versionInitial?: string;
  } = {},
) {
  const tagRepository: TagRepositoryPort = {
    findMany: jest.fn(async () => []),
    findById: jest.fn(async () => null),
    findBySlug: jest.fn(async () => null),
    findBySlugs: jest.fn(async () => []),
    findByIdIncludingDeleted: jest.fn(async () => null),
    create: jest.fn(
      async ({ name, slug, nowIso }: { name: string; slug: string; nowIso: string }) => ({
        tagId: 'tag-1',
        name,
        slug,
        deletedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    ),
    update: jest.fn(
      async ({ tagId }: { tagId: string }) =>
        ({
          tagId,
          name: 'updated',
          slug: 'updated',
          deletedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }) as TagRow,
    ),
    softDelete: jest.fn(async () => true),
    restore: jest.fn(async () => null),
    ...opts.tagRepository,
  };

  const tagFollowRepository: TagFollowRepositoryPort = {
    followTag: jest.fn(async () => ({ followId: 'f', isNew: true })),
    unfollowTag: jest.fn(async () => ({ unfollowed: true })),
    listFollowedTags: jest.fn(async () => []),
  };

  const tagRankingRepository: TagRankingRepositoryPort = {
    findRelatedBySlug: jest.fn(async () => []),
    getPopularTags: jest.fn(async () => []),
    getTrendingTags: jest.fn(async () => []),
    ...opts.tagRankingRepository,
  };

  const cache = makeCache();
  if (opts.versionInitial !== undefined) {
    cache.set.mockResolvedValueOnce(undefined);
    (cache.get as jest.Mock).mockResolvedValueOnce(opts.versionInitial);
  }
  const bus = makeBus();

  const service = new TagDomainService(
    tagRepository,
    tagFollowRepository,
    tagRankingRepository,
    bus,
    cache as unknown as RedisService,
    makeLogger(),
  );

  return { service, tagRepository, tagRankingRepository, cache, bus };
}

const baseCreateCommand: CreateTagCommand = { name: 'Math', slug: 'math' };
const baseUpdateCommand: UpdateTagCommand = { name: 'Mathematics' };

describe('TagDomainService — ranking cache version bumps', () => {
  it('createTag bumps the version after the event is emitted', async () => {
    const cache = makeCache();
    (cache.get as jest.Mock).mockResolvedValueOnce(null); // version lookup
    const bus = makeBus();
    const service = new TagDomainService(
      {
        findById: jest.fn(),
        create: jest.fn(async ({ slug }: { slug: string }) => ({
          tagId: 'tag-1',
          name: 'Math',
          slug,
          deletedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      } as unknown as TagRepositoryPort,
      {
        followTag: jest.fn(),
        unfollowTag: jest.fn(),
        listFollowedTags: jest.fn(),
      },
      {
        findRelatedBySlug: jest.fn(),
        getPopularTags: jest.fn(),
        getTrendingTags: jest.fn(),
      },
      bus,
      cache as unknown as RedisService,
      makeLogger(),
    );

    await service.createTag(baseCreateCommand);

    expect(bus.emitTagCreated).toHaveBeenCalledTimes(1);
    const incrCalls = (cache.incrementCounterWithInitialTtlSeconds as jest.Mock).mock.calls;
    expect(incrCalls).toHaveLength(1);
    expect(incrCalls[0][0]).toBe('tag:ranking:version');
  });

  it('updateTag bumps the version after the event is emitted', async () => {
    const cache = makeCache();
    (cache.get as jest.Mock).mockResolvedValueOnce('4'); // current version
    const bus = makeBus();
    const service = new TagDomainService(
      {
        findById: jest.fn(),
        update: jest.fn(async ({ tagId }: { tagId: string; patch: unknown; nowIso: string }) => ({
          tagId,
          name: 'Mathematics',
          slug: 'math',
          deletedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        })),
      } as unknown as TagRepositoryPort,
      {
        followTag: jest.fn(),
        unfollowTag: jest.fn(),
        listFollowedTags: jest.fn(),
      },
      {
        findRelatedBySlug: jest.fn(),
        getPopularTags: jest.fn(),
        getTrendingTags: jest.fn(),
      },
      bus,
      cache as unknown as RedisService,
      makeLogger(),
    );

    await service.updateTag('tag-1', baseUpdateCommand);

    expect(bus.emitTagUpdated).toHaveBeenCalledTimes(1);
    const incrCalls = (cache.incrementCounterWithInitialTtlSeconds as jest.Mock).mock.calls;
    expect(incrCalls).toHaveLength(1);
    expect(incrCalls[0][0]).toBe('tag:ranking:version');
  });

  it('deleteTag still bumps the version (regression guard)', async () => {
    const cache = makeCache();
    (cache.get as jest.Mock).mockResolvedValueOnce(null);
    const bus = makeBus();
    const service = new TagDomainService(
      {
        findById: jest.fn(),
        softDelete: jest.fn(async () => true),
      } as unknown as TagRepositoryPort,
      {
        followTag: jest.fn(),
        unfollowTag: jest.fn(),
        listFollowedTags: jest.fn(),
      },
      {
        findRelatedBySlug: jest.fn(),
        getPopularTags: jest.fn(),
        getTrendingTags: jest.fn(),
      },
      bus,
      cache as unknown as RedisService,
      makeLogger(),
    );

    await service.deleteTag('tag-1');

    expect(bus.emitTagDeleted).toHaveBeenCalledTimes(1);
    expect((cache.incrementCounterWithInitialTtlSeconds as jest.Mock).mock.calls[0][0]).toBe(
      'tag:ranking:version',
    );
  });

  it('getPopularTags uses a versioned cache key with stampede protection', async () => {
    const cache = makeCache();
    const rows = [{ slug: 'math', count: 5 }];
    const tagRankingRepository = {
      findRelatedBySlug: jest.fn(),
      getPopularTags: jest.fn(async () => rows),
      getTrendingTags: jest.fn(),
    } as unknown as TagRankingRepositoryPort;
    const bus = makeBus();
    const service = new TagDomainService(
      {} as unknown as TagRepositoryPort,
      {} as unknown as TagFollowRepositoryPort,
      tagRankingRepository,
      bus,
      cache as unknown as RedisService,
      makeLogger(),
    );

    await service.getPopularTags({ limit: 20 });

    expect(cache.getOrSetWithStampedeProtection).toHaveBeenCalledWith(
      'tag:ranking:popular:20:v0',
      600_000,
      expect.any(Function),
      5_000,
      50,
      10,
    );
  });

  it('getPopularTags reads via cache and writes through on miss', async () => {
    const cache = makeCache();
    (cache.getOrSetWithStampedeProtection as jest.Mock).mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    );
    const rows = [{ slug: 'math', count: 5 }];
    const tagRankingRepository = {
      findRelatedBySlug: jest.fn(),
      getPopularTags: jest.fn(async () => rows),
      getTrendingTags: jest.fn(),
    } as unknown as TagRankingRepositoryPort;
    const service = new TagDomainService(
      {} as unknown as TagRepositoryPort,
      {} as unknown as TagFollowRepositoryPort,
      tagRankingRepository,
      makeBus(),
      cache as unknown as RedisService,
      makeLogger(),
    );

    const result = await service.getPopularTags({ limit: 10 });

    expect(result).toEqual(rows);
    expect(tagRankingRepository.getPopularTags).toHaveBeenCalledTimes(1);
  });

  it('propagates error when cache completely fails', async () => {
    const cache = makeCache();
    (cache.getOrSetWithStampedeProtection as jest.Mock).mockRejectedValue(
      new Error('redis completely down'),
    );
    const tagRankingRepository = {
      findRelatedBySlug: jest.fn(),
      getPopularTags: jest.fn(),
      getTrendingTags: jest.fn(),
    } as unknown as TagRankingRepositoryPort;
    const service = new TagDomainService(
      {} as unknown as TagRepositoryPort,
      {} as unknown as TagFollowRepositoryPort,
      tagRankingRepository,
      makeBus(),
      cache as unknown as RedisService,
      makeLogger(),
    );

    await expect(service.getPopularTags({ limit: 10 })).rejects.toThrow('redis completely down');
  });
});
