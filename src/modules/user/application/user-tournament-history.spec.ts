/// <reference types="jest" />
import { UserDomainService } from '../domain/user.service';

describe('UserDomainService getMyTournamentHistory', () => {
  const createService = () => {
    const userRepository = {
      findMeById: jest.fn(),
      findUserProfileSettings: jest.fn(),
      listMyTournamentHistory: jest.fn(),
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

    const service = new UserDomainService(
      userRepository as never,
      eventBus as never,
      logger as never,
    );

    return {
      service,
      userRepository: userRepository as {
        findMeById: jest.Mock;
        findUserProfileSettings: jest.Mock;
        listMyTournamentHistory: jest.Mock;
      },
    };
  };

  it('returns history retrieval result', async () => {
    const { service, userRepository } = createService();
    userRepository.listMyTournamentHistory.mockResolvedValue({
      items: [
        {
          participantId: 'p-1',
          tournamentId: 't-1',
          tournamentName: 'Spring Challenge',
          finalRank: 12,
          finalScore: 540,
          participantCount: 523,
          completedAt: '2026-06-01T00:00:00Z',
        },
      ],
      hasNextPage: false,
    });

    const result = await service.getMyTournamentHistory({
      userId: 'u-1',
      requesterId: 'u-1',
      limit: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('passes pagination to repository', async () => {
    const { service, userRepository } = createService();
    userRepository.listMyTournamentHistory.mockResolvedValue({ items: [], hasNextPage: false });

    await service.getMyTournamentHistory({
      userId: 'u-1',
      requesterId: 'u-1',
      limit: 5,
    });

    expect(userRepository.listMyTournamentHistory).toHaveBeenCalledWith({
      userId: 'u-1',
      limit: 5,
      cursor: null,
    });
  });

  it('keeps newest-first ordering from repository results', async () => {
    const { service, userRepository } = createService();
    userRepository.listMyTournamentHistory.mockResolvedValue({
      items: [
        {
          participantId: 'p-new',
          tournamentId: 't-new',
          tournamentName: 'Newest',
          finalRank: 3,
          finalScore: 800,
          participantCount: 50,
          completedAt: '2026-06-03T00:00:00Z',
        },
        {
          participantId: 'p-old',
          tournamentId: 't-old',
          tournamentName: 'Older',
          finalRank: 8,
          finalScore: 400,
          participantCount: 60,
          completedAt: '2026-05-01T00:00:00Z',
        },
      ],
      hasNextPage: false,
    });

    const result = await service.getMyTournamentHistory({
      userId: 'u-1',
      requesterId: 'u-1',
      limit: 20,
    });

    expect(result.items[0]?.tournamentId).toBe('t-new');
    expect(result.items[1]?.tournamentId).toBe('t-old');
  });

  it('returns completed tournaments only from repository results', async () => {
    const { service, userRepository } = createService();
    userRepository.listMyTournamentHistory.mockResolvedValue({
      items: [
        {
          participantId: 'p-finished',
          tournamentId: 't-finished',
          tournamentName: 'Finished',
          finalRank: 5,
          finalScore: 300,
          participantCount: 30,
          completedAt: '2026-05-01T00:00:00Z',
        },
      ],
      hasNextPage: false,
    });

    const result = await service.getMyTournamentHistory({
      userId: 'u-1',
      requesterId: 'u-1',
      limit: 20,
    });

    expect(result.items).toEqual([expect.objectContaining({ tournamentId: 't-finished' })]);
  });
});
