import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { LeaderboardService } from './leaderboard.service';
import { RankingPeriod } from '../types/ranking.types';
import { LeaderboardPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
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

function makeCache(): CacheProvider {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn().mockImplementation((_key, _ttl, fn) => fn()),
    getOrSetWithStampedeProtection: jest.fn().mockImplementation((_key, _ttl, fn) => fn()),
    rpushJson: jest.fn(),
    lpopJson: jest.fn(),
    lrangeJson: jest.fn(),
    trimList: jest.fn(),
    expire: jest.fn(),
    zaddByScore: jest.fn(),
    zrangeByScore: jest.fn(),
    zrem: jest.fn(),
    unlinkByPattern: jest.fn(),
    getDel: jest.fn(),
    acquireAdvisoryLock: jest.fn(),
    releaseAdvisoryLock: jest.fn(),
    incrementWindowCounter: jest.fn(),
    incrementCounterWithInitialTtlSeconds: jest.fn(),
    setIfNotExistsWithTtlSeconds: jest.fn(),
    listLength: jest.fn(),
    pipelineDeadLetterPush: jest.fn(),
  } as unknown as CacheProvider;
}

function makePeriodReset(): PeriodResetService {
  return {
    getNextResetTime: jest.fn().mockReturnValue(new Date('2030-01-01T00:00:00.000Z')),
  } as unknown as PeriodResetService;
}

function makeVersionService(initialVersion = 0): {
  service: RankingCacheVersionService;
  bumpVersion: jest.Mock;
} {
  let version = initialVersion;
  const bumpVersion = jest.fn(async () => {
    version += 1;
  });
  const service = {
    getVersion: jest.fn(async () => version),
    bumpVersion,
    bumpAllPeriods: jest.fn(async () => {
      version += 1;
    }),
    versionKeyFor: jest.fn((period: RankingPeriod) => `ranking:version:${period}`),
  } as unknown as RankingCacheVersionService;
  return { service, bumpVersion };
}

describe('LeaderboardService — versioned cache keys', () => {
  it('embeds the current version in the leaderboard cache key', async () => {
    const { service: versionService } = makeVersionService(3);
    const repository = {
      getLeaderboard: jest.fn().mockResolvedValue([]),
      getTotalParticipants: jest.fn().mockResolvedValue(0),
    } as unknown as RankingRepositoryPort;

    const cache = makeCache();
    const service = new LeaderboardService(
      repository,
      cache,
      makePeriodReset(),
      versionService,
      makeLogger(),
    );

    await service.getGlobalLeaderboard({
      period: LeaderboardPeriodEnum.WEEKLY,
      limit: 20,
      offset: 0,
    });

    expect(cache.getOrSetWithStampedeProtection).toHaveBeenCalledWith(
      'lb:weekly:20:0:v3',
      expect.any(Number),
      expect.any(Function),
    );
  });

  it('a version bump causes the next read to fetch fresh', async () => {
    const { service: versionService, bumpVersion } = makeVersionService(0);
    const repository = {
      getLeaderboard: jest.fn().mockResolvedValue([]),
      getTotalParticipants: jest.fn().mockResolvedValue(0),
    } as unknown as RankingRepositoryPort;

    const cache = makeCache();
    const service = new LeaderboardService(
      repository,
      cache,
      makePeriodReset(),
      versionService,
      makeLogger(),
    );

    await service.getGlobalLeaderboard({
      period: LeaderboardPeriodEnum.WEEKLY,
      limit: 20,
      offset: 0,
    });

    const allCallsAfterFirst = (cache.getOrSetWithStampedeProtection as jest.Mock).mock.calls;
    expect(allCallsAfterFirst.some(([key]: [string]) => key === 'lb:weekly:20:0:v0')).toBe(true);

    await bumpVersion();

    await service.getGlobalLeaderboard({
      period: LeaderboardPeriodEnum.WEEKLY,
      limit: 20,
      offset: 0,
    });

    const allCallsAfterSecond = (cache.getOrSetWithStampedeProtection as jest.Mock).mock.calls;
    expect(allCallsAfterSecond.some(([key]: [string]) => key === 'lb:weekly:20:0:v1')).toBe(true);
  });

  it('embeds the version in the user position key', async () => {
    const { service: versionService } = makeVersionService(7);
    const repository = {
      getUserRanking: jest.fn().mockResolvedValue(null),
      getTotalParticipants: jest.fn().mockResolvedValue(0),
    } as unknown as RankingRepositoryPort;

    const cache = makeCache();
    const service = new LeaderboardService(
      repository,
      cache,
      makePeriodReset(),
      versionService,
      makeLogger(),
    );

    await service.getUserPosition('user-1', LeaderboardPeriodEnum.ALL_TIME);

    expect(cache.getOrSetWithStampedeProtection).toHaveBeenCalledWith(
      'pos:user-1:all_time:v7',
      expect.any(Number),
      expect.any(Function),
    );
  });

  it('embeds the version in the total participants key', async () => {
    const { service: versionService } = makeVersionService(5);
    const repository = {
      getLeaderboardCursorFirstPage: jest.fn().mockResolvedValue([]),
      getTotalParticipants: jest.fn().mockResolvedValue(0),
    } as unknown as RankingRepositoryPort;

    const cache = makeCache();
    const service = new LeaderboardService(
      repository,
      cache,
      makePeriodReset(),
      versionService,
      makeLogger(),
    );

    await service.getGlobalLeaderboardCursor({
      period: LeaderboardPeriodEnum.MONTHLY,
      limit: 10,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });

    expect(cache.getOrSetWithStampedeProtection).toHaveBeenCalledWith(
      'total:monthly:v5',
      expect.any(Number),
      expect.any(Function),
    );
  });

  it('falls back to version 0 when the cache lookup fails', async () => {
    const versionService = {
      getVersion: jest.fn().mockResolvedValue(0),
      bumpVersion: jest.fn(),
      bumpAllPeriods: jest.fn(),
      versionKeyFor: jest.fn(),
    } as unknown as RankingCacheVersionService;
    const repository = {
      getLeaderboard: jest.fn().mockResolvedValue([]),
      getTotalParticipants: jest.fn().mockResolvedValue(0),
    } as unknown as RankingRepositoryPort;

    const cache = makeCache();
    const service = new LeaderboardService(
      repository,
      cache,
      makePeriodReset(),
      versionService,
      makeLogger(),
    );

    await expect(
      service.getGlobalLeaderboard({
        period: LeaderboardPeriodEnum.ALL_TIME,
        limit: 10,
        offset: 0,
      }),
    ).resolves.toBeDefined();
    expect(cache.getOrSetWithStampedeProtection).toHaveBeenCalledWith(
      'lb:all_time:10:0:v0',
      expect.any(Number),
      expect.any(Function),
    );
  });
});
