import type { PinoLogger } from 'nestjs-pino';
import { LeaderboardService } from './leaderboard.service';
import { RankingPeriod } from '../types/ranking.types';
import { LeaderboardPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import type { RankingRepositoryPort, LeaderboardRow } from '../ports/ranking-repository.port';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { PeriodResetService } from './period-reset.service';

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
  } as unknown as CacheProvider;
}

function makePeriodReset(): PeriodResetService {
  return {
    getNextResetTime: jest.fn().mockReturnValue(new Date('2030-01-01T00:00:00.000Z')),
  } as unknown as PeriodResetService;
}

describe('LeaderboardService.getGlobalLeaderboardCursor', () => {
  it('returns the first page via getLeaderboardCursorFirstPage when no cursor is supplied', async () => {
    const rows: LeaderboardRow[] = [
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 1000,
        rank: 1,
        denseRank: 1,
      },
    ];

    const repository: Pick<
      RankingRepositoryPort,
      'getLeaderboardCursorFirstPage' | 'getLeaderboardKeyset' | 'getTotalParticipants'
    > = {
      getLeaderboardCursorFirstPage: jest.fn().mockResolvedValue(rows),
      getLeaderboardKeyset: jest.fn(),
      getTotalParticipants: jest.fn().mockResolvedValue(1),
    };

    const service = new LeaderboardService(
      repository as RankingRepositoryPort,
      makeCache(),
      makePeriodReset(),
      makeLogger(),
    );

    const result = await service.getGlobalLeaderboardCursor({
      period: LeaderboardPeriodEnum.ALL_TIME,
      limit: 2,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });

    expect(repository.getLeaderboardCursorFirstPage).toHaveBeenCalledWith({
      period: RankingPeriod.ALL_TIME,
      limit: 2,
    });
    expect(repository.getLeaderboardKeyset).not.toHaveBeenCalled();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].isTied).toBe(false);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('returns a non-empty cursor on the next page when the page is full', async () => {
    const rows: LeaderboardRow[] = [
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 1000,
        rank: 1,
        denseRank: 1,
      },
      {
        userId: '22222222-2222-7222-8222-222222222222',
        displayName: 'Bob',
        username: 'bob',
        avatarUrl: null,
        xp: 900,
        rank: 2,
        denseRank: 2,
      },
    ];

    const repository: Pick<
      RankingRepositoryPort,
      'getLeaderboardCursorFirstPage' | 'getLeaderboardKeyset' | 'getTotalParticipants'
    > = {
      getLeaderboardCursorFirstPage: jest.fn(),
      getLeaderboardKeyset: jest.fn().mockResolvedValue(rows),
      getTotalParticipants: jest.fn().mockResolvedValue(5000),
    };

    const service = new LeaderboardService(
      repository as RankingRepositoryPort,
      makeCache(),
      makePeriodReset(),
      makeLogger(),
    );

    const result = await service.getGlobalLeaderboardCursor({
      period: LeaderboardPeriodEnum.WEEKLY,
      limit: 2,
      cursorXp: 1100,
      cursorCreatedAt: '2026-05-01T00:00:00.000Z',
      cursorUserId: '33333333-3333-7333-8333-333333333333',
    });

    expect(repository.getLeaderboardKeyset).toHaveBeenCalledWith({
      period: RankingPeriod.WEEKLY,
      limit: 2,
      cursorXp: 1100,
      cursorCreatedAt: '2026-05-01T00:00:00.000Z',
      cursorUserId: '33333333-3333-7333-8333-333333333333',
    });
    expect(repository.getLeaderboardCursorFirstPage).not.toHaveBeenCalled();
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.cursor).toEqual({
      xp: 900,
      createdAt: expect.any(String),
      userId: '22222222-2222-7222-8222-222222222222',
    });
  });

  it('returns hasMore=false when the page is not full', async () => {
    const rows: LeaderboardRow[] = [
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 1000,
        rank: 1,
        denseRank: 1,
      },
    ];

    const repository: Pick<
      RankingRepositoryPort,
      'getLeaderboardCursorFirstPage' | 'getLeaderboardKeyset' | 'getTotalParticipants'
    > = {
      getLeaderboardCursorFirstPage: jest.fn(),
      getLeaderboardKeyset: jest.fn().mockResolvedValue(rows),
      getTotalParticipants: jest.fn().mockResolvedValue(1),
    };

    const service = new LeaderboardService(
      repository as RankingRepositoryPort,
      makeCache(),
      makePeriodReset(),
      makeLogger(),
    );

    const result = await service.getGlobalLeaderboardCursor({
      period: LeaderboardPeriodEnum.MONTHLY,
      limit: 10,
      cursorXp: 2000,
      cursorCreatedAt: '2026-04-01T00:00:00.000Z',
      cursorUserId: '99999999-9999-7999-8999-999999999999',
    });

    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.cursor).toBeUndefined();
  });

  it('flags isTied=true for adjacent rows with identical xp', async () => {
    const rows: LeaderboardRow[] = [
      {
        userId: '11111111-1111-7111-8111-111111111111',
        displayName: 'Alice',
        username: 'alice',
        avatarUrl: null,
        xp: 1000,
        rank: 1,
        denseRank: 1,
      },
      {
        userId: '22222222-2222-7222-8222-222222222222',
        displayName: 'Bob',
        username: 'bob',
        avatarUrl: null,
        xp: 1000,
        rank: 1,
        denseRank: 1,
      },
    ];

    const repository: Pick<
      RankingRepositoryPort,
      'getLeaderboardCursorFirstPage' | 'getLeaderboardKeyset' | 'getTotalParticipants'
    > = {
      getLeaderboardCursorFirstPage: jest.fn().mockResolvedValue(rows),
      getLeaderboardKeyset: jest.fn(),
      getTotalParticipants: jest.fn().mockResolvedValue(2),
    };

    const service = new LeaderboardService(
      repository as RankingRepositoryPort,
      makeCache(),
      makePeriodReset(),
      makeLogger(),
    );

    const result = await service.getGlobalLeaderboardCursor({
      period: LeaderboardPeriodEnum.ALL_TIME,
      limit: 10,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });

    expect(result.entries[0].isTied).toBe(false);
    expect(result.entries[1].isTied).toBe(true);
  });
});
