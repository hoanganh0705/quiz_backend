/// <reference types="jest" />
import { UserDomainService } from '../domain/user.service';

describe('UserDomainService getMyTournamentAnalytics', () => {
  const createService = () => {
    const userRepository = {
      findMeById: jest.fn(),
      findUserProfileSettings: jest.fn(),
      getMyTournamentAnalytics: jest.fn(),
    } as unknown as ConstructorParameters<typeof UserDomainService>[0];

    const eventBus = {
      subscribe: jest.fn(),
      emitProfileUpdated: jest.fn(),
      emitSettingsUpdated: jest.fn(),
    } as unknown as ConstructorParameters<typeof UserDomainService>[1];

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as ConstructorParameters<typeof UserDomainService>[2];

    const service = new UserDomainService(userRepository as never, eventBus as never, logger as never);

    return {
      service,
      userRepository: userRepository as {
        findMeById: jest.Mock;
        findUserProfileSettings: jest.Mock;
        getMyTournamentAnalytics: jest.Mock;
      },
    };
  };

  it('returns analytics retrieval result', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.getMyTournamentAnalytics.mockResolvedValue({
      tournamentsPlayed: 45,
      wins: 6,
      top3Finishes: 11,
      top10Finishes: 18,
      averageRank: 21,
      bestRank: 1,
      averageScore: 84,
      totalTournamentScore: 12540,
      completionRate: 91,
      lastTournamentAt: '2026-06-01T00:00:00Z',
    });

    const result = await service.getMyTournamentAnalytics({ userId: 'u-1' });

    expect(result.tournamentsPlayed).toBe(45);
    expect(result.averageScore).toBe(84);
  });

  it('returns average rank calculation from repository result', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.getMyTournamentAnalytics.mockResolvedValue({
      tournamentsPlayed: 3,
      wins: 1,
      top3Finishes: 2,
      top10Finishes: 3,
      averageRank: 7,
      bestRank: 1,
      averageScore: 70,
      totalTournamentScore: 210,
      completionRate: 100,
      lastTournamentAt: '2026-06-01T00:00:00Z',
    });

    const result = await service.getMyTournamentAnalytics({ userId: 'u-1' });

    expect(result.averageRank).toBe(7);
  });

  it('returns win count from repository result', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.getMyTournamentAnalytics.mockResolvedValue({
      tournamentsPlayed: 8,
      wins: 2,
      top3Finishes: 3,
      top10Finishes: 5,
      averageRank: 9,
      bestRank: 1,
      averageScore: 77,
      totalTournamentScore: 616,
      completionRate: 80,
      lastTournamentAt: '2026-06-01T00:00:00Z',
    });

    const result = await service.getMyTournamentAnalytics({ userId: 'u-1' });

    expect(result.wins).toBe(2);
  });

  it('returns completion rate from repository result', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.getMyTournamentAnalytics.mockResolvedValue({
      tournamentsPlayed: 9,
      wins: 1,
      top3Finishes: 2,
      top10Finishes: 4,
      averageRank: 12,
      bestRank: 1,
      averageScore: 68,
      totalTournamentScore: 612,
      completionRate: 91,
      lastTournamentAt: '2026-06-01T00:00:00Z',
    });

    const result = await service.getMyTournamentAnalytics({ userId: 'u-1' });

    expect(result.completionRate).toBe(91);
  });

  it('returns zero analytics for user with no tournaments', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.getMyTournamentAnalytics.mockResolvedValue({
      tournamentsPlayed: 0,
      wins: 0,
      top3Finishes: 0,
      top10Finishes: 0,
      averageRank: null,
      bestRank: null,
      averageScore: 0,
      totalTournamentScore: 0,
      completionRate: 0,
      lastTournamentAt: null,
    });

    const result = await service.getMyTournamentAnalytics({ userId: 'u-1' });

    expect(result).toEqual({
      tournamentsPlayed: 0,
      wins: 0,
      top3Finishes: 0,
      top10Finishes: 0,
      averageRank: null,
      bestRank: null,
      averageScore: 0,
      totalTournamentScore: 0,
      completionRate: 0,
      lastTournamentAt: null,
    });
  });
});
