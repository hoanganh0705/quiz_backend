/// <reference types="jest" />
import { RankingPeriod } from '../domain/types/ranking.types';
import { GetMyRankMovementQueryHandler } from './get-my-rank-movement.query';

describe('GetMyRankMovementQueryHandler', () => {
  const createHandler = () => {
    const rankingRepository = {
      getLatestRankSnapshots: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetMyRankMovementQueryHandler>[0];

    const logger = {
      debug: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetMyRankMovementQueryHandler>[1];

    const handler = new GetMyRankMovementQueryHandler(rankingRepository as never, logger as never);

    return {
      handler,
      rankingRepository: rankingRepository as unknown as {
        getLatestRankSnapshots: jest.Mock;
      },
    };
  };

  it('returns positive movement when rank improves', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getLatestRankSnapshots.mockResolvedValue({
      current: {
        historyId: '2',
        userId: 'u1',
        period: RankingPeriod.DAILY,
        snapshotDate: '2026-06-02T00:00:00.000Z',
        rank: 95,
        xp: 0,
        recordedAt: '2026-06-02T00:00:00.000Z',
      },
      previous: {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.DAILY,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 120,
        xp: 0,
        recordedAt: '2026-06-01T00:00:00.000Z',
      },
    });

    await expect(handler.execute({ userId: 'u1', period: RankingPeriod.DAILY })).resolves.toEqual({
      previousRank: 120,
      currentRank: 95,
      change: 25,
      direction: 'up',
    });
  });

  it('returns negative movement when rank declines', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getLatestRankSnapshots.mockResolvedValue({
      current: {
        historyId: '2',
        userId: 'u1',
        period: RankingPeriod.WEEKLY,
        snapshotDate: '2026-06-08T00:00:00.000Z',
        rank: 72,
        xp: 0,
        recordedAt: '2026-06-08T00:00:00.000Z',
      },
      previous: {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.WEEKLY,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 50,
        xp: 0,
        recordedAt: '2026-06-01T00:00:00.000Z',
      },
    });

    await expect(handler.execute({ userId: 'u1', period: RankingPeriod.WEEKLY })).resolves.toEqual({
      previousRank: 50,
      currentRank: 72,
      change: -22,
      direction: 'down',
    });
  });

  it('returns stable movement when rank is unchanged', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getLatestRankSnapshots.mockResolvedValue({
      current: {
        historyId: '2',
        userId: 'u1',
        period: RankingPeriod.MONTHLY,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 80,
        xp: 0,
        recordedAt: '2026-06-01T00:00:00.000Z',
      },
      previous: {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.MONTHLY,
        snapshotDate: '2026-05-01T00:00:00.000Z',
        rank: 80,
        xp: 0,
        recordedAt: '2026-05-01T00:00:00.000Z',
      },
    });

    await expect(handler.execute({ userId: 'u1', period: RankingPeriod.MONTHLY })).resolves.toEqual(
      {
        previousRank: 80,
        currentRank: 80,
        change: 0,
        direction: 'stable',
      },
    );
  });

  it('returns unknown when only first snapshot exists', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getLatestRankSnapshots.mockResolvedValue({
      current: {
        historyId: '1',
        userId: 'u1',
        period: RankingPeriod.ALL_TIME,
        snapshotDate: '2026-06-01T00:00:00.000Z',
        rank: 120,
        xp: 0,
        recordedAt: '2026-06-01T00:00:00.000Z',
      },
      previous: null,
    });

    await expect(
      handler.execute({ userId: 'u1', period: RankingPeriod.ALL_TIME }),
    ).resolves.toEqual({
      previousRank: null,
      currentRank: 120,
      change: null,
      direction: 'unknown',
    });
  });

  it('supports different periods via repository query', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getLatestRankSnapshots.mockResolvedValue({ current: null, previous: null });

    await handler.execute({ userId: 'u1', period: RankingPeriod.WEEKLY });

    expect(rankingRepository.getLatestRankSnapshots).toHaveBeenCalledWith({
      userId: 'u1',
      period: RankingPeriod.WEEKLY,
    });
  });
});
