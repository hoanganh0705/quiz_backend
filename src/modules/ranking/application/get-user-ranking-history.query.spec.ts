/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { UserNotFoundError } from '@/modules/user/domain/errors/user-domain.errors';
import { GetUserRankingHistoryQueryHandler } from './get-user-ranking-history.query';
import { RankingPeriod } from '../domain/types/ranking.types';

describe('GetUserRankingHistoryQueryHandler', () => {
  const createHandler = () => {
    const rankingRepository = {
      getUserRankingHistory: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetUserRankingHistoryQueryHandler>[0];

    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn(),
            }),
          }),
        }),
      }),
    } as unknown as ConstructorParameters<typeof GetUserRankingHistoryQueryHandler>[1];

    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetUserRankingHistoryQueryHandler>[2];

    const handler = new GetUserRankingHistoryQueryHandler(
      rankingRepository as never,
      db as never,
      logger as never,
    );

    return {
      handler,
      rankingRepository: rankingRepository as unknown as {
        getUserRankingHistory: jest.Mock;
      },
      db: db as unknown as {
        select: jest.Mock;
      },
      logger: logger as unknown as {
        warn: jest.Mock;
      },
    };
  };

  const mockUserQueryResult = (
    db: { select: jest.Mock },
    rows: Array<{ userId: string; username: string }>,
  ) => {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ limit });
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    db.select.mockReturnValue({ from });
  };

  it('returns public user history with only userId, username, and history', async () => {
    const { handler, rankingRepository, db } = createHandler();
    mockUserQueryResult(db, [{ userId: 'u1', username: 'Anh' }]);
    rankingRepository.getUserRankingHistory.mockResolvedValue([
      {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.ALL_TIME,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 500,
        xp: 1000,
        recordedAt: '2026-06-01T00:05:00.000Z',
      },
    ]);

    await expect(
      handler.execute({
        targetUserId: 'u1',
        period: RankingPeriod.ALL_TIME,
      }),
    ).resolves.toEqual({
      userId: 'u1',
      username: 'Anh',
      history: [{ date: '2026-06-01', rank: 500 }],
    });
  });

  it('returns empty history for existing user without snapshots', async () => {
    const { handler, rankingRepository, db } = createHandler();
    mockUserQueryResult(db, [{ userId: 'u1', username: 'Anh' }]);
    rankingRepository.getUserRankingHistory.mockResolvedValue([]);

    await expect(
      handler.execute({
        targetUserId: 'u1',
        period: RankingPeriod.WEEKLY,
      }),
    ).resolves.toEqual({
      userId: 'u1',
      username: 'Anh',
      history: [],
    });
  });

  it('throws when target user does not exist', async () => {
    const { handler, db, logger } = createHandler();
    mockUserQueryResult(db, []);

    await expect(
      handler.execute({
        targetUserId: 'missing',
        period: RankingPeriod.MONTHLY,
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'get_public_ranking_history_user_not_found',
        targetUserId: 'missing',
      }),
    );
  });

  it('passes date filtering to repository', async () => {
    const { handler, rankingRepository, db } = createHandler();
    mockUserQueryResult(db, [{ userId: 'u1', username: 'Anh' }]);
    rankingRepository.getUserRankingHistory.mockResolvedValue([]);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-06-01T00:00:00.000Z');

    await handler.execute({
      targetUserId: 'u1',
      period: RankingPeriod.DAILY,
      from,
      to,
    });

    expect(rankingRepository.getUserRankingHistory).toHaveBeenCalledWith({
      userId: 'u1',
      period: RankingPeriod.DAILY,
      from,
      to,
    });
  });

  it('rejects invalid date range', async () => {
    const { handler, db } = createHandler();
    mockUserQueryResult(db, [{ userId: 'u1', username: 'Anh' }]);

    await expect(
      handler.execute({
        targetUserId: 'u1',
        period: RankingPeriod.DAILY,
        from: new Date('2026-06-03T00:00:00.000Z'),
        to: new Date('2026-06-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
