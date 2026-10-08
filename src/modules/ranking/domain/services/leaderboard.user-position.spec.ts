import type { PinoLogger } from 'nestjs-pino';
import { LeaderboardService } from './leaderboard.service';
import { RankingPeriodEnum, LeaderboardPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { PeriodResetService } from './period-reset.service';
import type { RankingCacheVersionService } from './ranking-cache-version.service';

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
  getOrSetWithStampedeProtection: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
}

function makeStore(): Store {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed;
    }),
    getOrSetWithStampedeProtection: jest.fn(
      async <T>(key: string, _ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
        const cached = store.get(key);
        if (cached !== undefined) {
          return JSON.parse(cached) as T;
        }
        const value = await fetcher();
        store.set(key, JSON.stringify(value));
        return value;
      },
    ),
  };
}

function makeRepository(overrides: Partial<RankingRepositoryPort> = {}): RankingRepositoryPort {
  return {
    getUserRanking: jest.fn(async (userId: string) =>
      userId === 'u1'
        ? {
            userId: 'u1',
            allTimeXp: 1234,
            weeklyXp: 100,
            monthlyXp: 250,
            allTimeRank: 5,
            weeklyRank: 2,
            monthlyRank: 1,
          }
        : null,
    ),
    getUserRank: jest.fn(async (_userId: string, period: string) => {
      if (period === 'all_time') return 5;
      if (period === 'weekly') return 2;
      if (period === 'monthly') return 1;
      return null;
    }),
    getLatestRankSnapshots: jest.fn(async () => []),
    getTotalParticipants: jest.fn(async () => 100),
    getNextRankXp: jest.fn(async (_period: string, rank: number) => rank * 1000),
    ...overrides,
  } as unknown as RankingRepositoryPort;
}

function makeVersion(version = 0): RankingCacheVersionService {
  return {
    getVersion: jest.fn().mockResolvedValue(version),
    bumpVersion: jest.fn().mockResolvedValue(undefined),
    bumpAllPeriods: jest.fn().mockResolvedValue(undefined),
    versionKeyFor: jest.fn((period: string) => `ranking:version:${period}`),
  } as unknown as RankingCacheVersionService;
}

function makePeriodReset(): PeriodResetService {
  return {
    getNextResetTime: jest.fn().mockReturnValue(new Date('2030-01-01T00:00:00.000Z')),
  } as unknown as PeriodResetService;
}

function makeService(repo: RankingRepositoryPort, store: Store, version = 0) {
  return new LeaderboardService(
    repo,
    store as unknown as CacheProvider,
    makePeriodReset(),
    makeVersion(version),
    makeLogger(),
  );
}

describe('LeaderboardService.getUserPosition — cache hit / miss / version bump', () => {
  it('cache miss → ranking repo → cache write with versioned key', async () => {
    const repo = makeRepository();
    const store = makeStore();
    const service = makeService(repo, store, 3);

    const result = await service.getUserPosition('u1', LeaderboardPeriodEnum.ALL_TIME);

    expect(result).not.toBeNull();
    expect(result?.rank).toBe(5);
    expect(result?.xp).toBe(1234);

    const keys = Array.from(store.store.keys());
    expect(keys).toContain('pos:u1:all_time:v3');
    expect(JSON.parse(store.store.get('pos:u1:all_time:v3') as string)).toMatchObject({
      rank: 5,
      xp: 1234,
    });
    expect(repo.getUserRanking).toHaveBeenCalledWith('u1');
    expect(repo.getUserRank).toHaveBeenCalledWith('u1', 'all_time');
  });

  it('cache hit → returns the previously written value without re-querying the repository', async () => {
    const repo = makeRepository();
    const store = makeStore();
    store.store.set(
      'pos:u1:all_time:v3',
      JSON.stringify({
        rank: 9,
        denseRank: 9,
        percentile: 91,
        percentileLabel: 'Top 10%',
        xp: 500,
        xpToNextRank: 1500,
        nextRankXp: 2000,
        trend: 'SAME',
        trendAmount: null,
      }),
    );
    const service = makeService(repo, store, 3);

    const result = await service.getUserPosition('u1', LeaderboardPeriodEnum.ALL_TIME);

    expect(result?.rank).toBe(9);
    expect(result?.xp).toBe(500);
    expect(repo.getUserRanking).not.toHaveBeenCalled();
    expect(repo.getUserRank).not.toHaveBeenCalled();
  });

  it('version bump invalidates by switching to a new key (bypass stale cache)', async () => {
    const repo = makeRepository();
    const store = makeStore();
    store.store.set(
      'pos:u1:all_time:v3',
      JSON.stringify({
        rank: 9,
        denseRank: 9,
        percentile: 91,
        percentileLabel: 'Top 10%',
        xp: 500,
        xpToNextRank: 1500,
        nextRankXp: 2000,
        trend: 'SAME',
        trendAmount: null,
      }),
    );

    const beforeBump = makeService(repo, store, 3);
    const first = await beforeBump.getUserPosition('u1', LeaderboardPeriodEnum.ALL_TIME);
    expect(first?.rank).toBe(9);

    const service = makeService(repo, store, 4);

    const second = await service.getUserPosition('u1', LeaderboardPeriodEnum.ALL_TIME);

    expect(second?.rank).toBe(5);
    expect(store.store.has('pos:u1:all_time:v4')).toBe(true);
    expect(repo.getUserRanking).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for a user without ranking data and caches the miss', async () => {
    const repo = makeRepository();
    const store = makeStore();
    const service = makeService(repo, store, 0);

    const result = await service.getUserPosition('unknown-user', RankingPeriodEnum.DAILY);

    expect(result).toBeUndefined();
    const keys = Array.from(store.store.keys());
    const dailyKey = keys.find((k) => k.startsWith('pos:unknown-user:daily:'));
    expect(dailyKey).toBeDefined();
    expect(JSON.parse(store.store.get(dailyKey as string) as string)).toBeNull();
  });

  it('uses the configured USER_RANK_CACHE_TTL stampede protection TTL', async () => {
    const repo = makeRepository();
    const store = makeStore();
    const service = makeService(repo, store, 0);

    await service.getUserPosition('u1', LeaderboardPeriodEnum.WEEKLY);

    expect(store.getOrSetWithStampedeProtection).toHaveBeenCalledWith(
      expect.stringContaining('pos:u1:weekly:'),
      10_000,
      expect.any(Function),
    );
  });
});
