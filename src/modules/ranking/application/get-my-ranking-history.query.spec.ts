/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { GetMyRankingHistoryQueryHandler } from './get-my-ranking-history.query';
import { RankingPeriod } from '../domain/types/ranking.types';

describe('GetMyRankingHistoryQueryHandler', () => {
  const createHandler = () => {
    const rankingRepository = {
      getUserRankingHistory: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetMyRankingHistoryQueryHandler>[0];

    const logger = {
      debug: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetMyRankingHistoryQueryHandler>[1];

    const handler = new GetMyRankingHistoryQueryHandler(
      rankingRepository as never,
      logger as never,
    );

    return {
      handler,
      rankingRepository: rankingRepository as unknown as {
        getUserRankingHistory: jest.Mock;
      },
    };
  };

  it('returns daily history ordered oldest to newest', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRankingHistory.mockResolvedValue([
      {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.DAILY,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 142,
        xp: 1000,
        recordedAt: '2026-06-01T00:05:00.000Z',
      },
      {
        historyId: '2',
        userId: 'u1',
        period: RankingPeriod.DAILY,
        snapshotDate: '2026-06-02T00:00:00.000Z',
        rank: 118,
        xp: 1200,
        recordedAt: '2026-06-02T00:05:00.000Z',
      },
    ]);

    await expect(
      handler.execute({
        userId: 'u1',
        period: RankingPeriod.DAILY,
      }),
    ).resolves.toEqual({
      items: [
        { date: '2026-06-01', rank: 142 },
        { date: '2026-06-02', rank: 118 },
      ],
    });
  });

  it('passes weekly period and filters to repository', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRankingHistory.mockResolvedValue([]);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-06-01T00:00:00.000Z');

    await handler.execute({
      userId: 'u1',
      period: RankingPeriod.WEEKLY,
      from,
      to,
    });

    expect(rankingRepository.getUserRankingHistory).toHaveBeenCalledWith({
      userId: 'u1',
      period: RankingPeriod.WEEKLY,
      from,
      to,
    });
  });

  it('supports monthly history', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRankingHistory.mockResolvedValue([
      {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.MONTHLY,
        snapshotDate: '2026-05-01T00:00:00.000Z',
        rank: 25,
        xp: 3500,
        recordedAt: '2026-05-01T00:05:00.000Z',
      },
    ]);

    await expect(
      handler.execute({
        userId: 'u1',
        period: RankingPeriod.MONTHLY,
      }),
    ).resolves.toEqual({
      items: [{ date: '2026-05-01', rank: 25 }],
    });
  });

  it('returns empty history when no snapshots exist', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRankingHistory.mockResolvedValue([]);

    await expect(
      handler.execute({
        userId: 'u1',
        period: RankingPeriod.ALL_TIME,
      }),
    ).resolves.toEqual({ items: [] });
  });

  it('preserves repository ordering correctness for all-time history', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRankingHistory.mockResolvedValue([
      {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.ALL_TIME,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 200,
        xp: 1000,
        recordedAt: '2026-06-01T00:05:00.000Z',
      },
      {
        historyId: '2',
        userId: 'u1',
        period: RankingPeriod.ALL_TIME,
        snapshotDate: '2026-06-03T00:00:00.000Z',
        rank: 101,
        xp: 1800,
        recordedAt: '2026-06-03T00:05:00.000Z',
      },
    ]);

    const result = await handler.execute({
      userId: 'u1',
      period: RankingPeriod.ALL_TIME,
    });

    expect(result.items.map((item) => item.date)).toEqual(['2026-06-01', '2026-06-03']);
  });

  it('rejects invalid date range', async () => {
    const { handler } = createHandler();

    await expect(
      handler.execute({
        userId: 'u1',
        period: RankingPeriod.DAILY,
        from: new Date('2026-06-03T00:00:00.000Z'),
        to: new Date('2026-06-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
