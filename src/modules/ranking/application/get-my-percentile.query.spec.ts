/// <reference types="jest" />
import { RankingPeriod } from '../domain/types/ranking.types';
import { GetMyPercentileQueryHandler } from './get-my-percentile.query';

describe('GetMyPercentileQueryHandler', () => {
  const createHandler = () => {
    const rankingRepository = {
      getUserRank: jest.fn(),
      getLeaderboardSize: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetMyPercentileQueryHandler>[0];

    const logger = {
      debug: jest.fn(),
    } as unknown as ConstructorParameters<typeof GetMyPercentileQueryHandler>[1];

    const handler = new GetMyPercentileQueryHandler(rankingRepository as never, logger as never);

    return {
      handler,
      rankingRepository: rankingRepository as unknown as {
        getUserRank: jest.Mock;
        getLeaderboardSize: jest.Mock;
      },
    };
  };

  it('returns 99.9 percentile for top ranked user', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRank.mockResolvedValue(1);
    rankingRepository.getLeaderboardSize.mockResolvedValue(1000);

    await expect(
      handler.execute({
        userId: 'user-1',
        period: RankingPeriod.ALL_TIME,
      }),
    ).resolves.toEqual({
      rank: 1,
      totalUsers: 1000,
      percentile: 99.9,
      betterThanUsers: 999,
      worseThanUsers: 0,
    });
  });

  it('returns correct percentile for middle ranked user', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRank.mockResolvedValue(125);
    rankingRepository.getLeaderboardSize.mockResolvedValue(10000);

    await expect(
      handler.execute({
        userId: 'user-2',
        period: RankingPeriod.WEEKLY,
      }),
    ).resolves.toEqual({
      rank: 125,
      totalUsers: 10000,
      percentile: 98.75,
      betterThanUsers: 9875,
      worseThanUsers: 124,
    });
  });

  it('returns 0 percentile for last ranked user', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRank.mockResolvedValue(250);
    rankingRepository.getLeaderboardSize.mockResolvedValue(250);

    await expect(
      handler.execute({
        userId: 'user-3',
        period: RankingPeriod.MONTHLY,
      }),
    ).resolves.toEqual({
      rank: 250,
      totalUsers: 250,
      percentile: 0,
      betterThanUsers: 0,
      worseThanUsers: 249,
    });
  });

  it('returns null percentile for empty leaderboard', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRank.mockResolvedValue(null);
    rankingRepository.getLeaderboardSize.mockResolvedValue(0);

    await expect(
      handler.execute({
        userId: 'user-4',
        period: RankingPeriod.ALL_TIME,
      }),
    ).resolves.toEqual({
      rank: null,
      totalUsers: 0,
      percentile: null,
      betterThanUsers: null,
      worseThanUsers: null,
    });
  });

  it('returns null percentile when user is not ranked yet', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRank.mockResolvedValue(null);
    rankingRepository.getLeaderboardSize.mockResolvedValue(100);

    await expect(
      handler.execute({
        userId: 'user-5',
        period: RankingPeriod.DAILY,
      }),
    ).resolves.toEqual({
      rank: null,
      totalUsers: 100,
      percentile: null,
      betterThanUsers: null,
      worseThanUsers: null,
    });
  });

  it('applies period filtering by querying the requested period', async () => {
    const { handler, rankingRepository } = createHandler();
    rankingRepository.getUserRank.mockResolvedValue(50);
    rankingRepository.getLeaderboardSize.mockResolvedValue(200);

    await handler.execute({
      userId: 'user-6',
      period: RankingPeriod.MONTHLY,
    });

    expect(rankingRepository.getUserRank).toHaveBeenCalledWith('user-6', RankingPeriod.MONTHLY);
    expect(rankingRepository.getLeaderboardSize).toHaveBeenCalledWith(RankingPeriod.MONTHLY);
  });
});
