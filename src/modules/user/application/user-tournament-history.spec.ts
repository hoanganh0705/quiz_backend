/// <reference types="jest" />
import { UserDomainService } from '../domain/user.service';
import { UserNotFoundError } from '../domain/errors';

describe('UserDomainService getUserTournamentHistory', () => {
  const createService = () => {
    const userRepository = {
      findMeById: jest.fn(),
      listMyTournamentHistory: jest.fn(),
    } as unknown as ConstructorParameters<typeof UserDomainService>[0];

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as ConstructorParameters<typeof UserDomainService>[1];

    const service = new UserDomainService(userRepository as never, logger as never);

    return {
      service,
      userRepository: userRepository as {
        findMeById: jest.Mock;
        listMyTournamentHistory: jest.Mock;
      },
    };
  };

  it('returns history retrieval result', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.listMyTournamentHistory.mockResolvedValue({
      items: [
        {
          tournamentId: 't-1',
          tournamentName: 'Spring Challenge',
          finalRank: 12,
          finalScore: 540,
          participantCount: 523,
          completedAt: '2026-06-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    const result = await service.getUserTournamentHistory({ userId: 'u-1', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('passes pagination to repository', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.listMyTournamentHistory.mockResolvedValue({ items: [], total: 0 });

    await service.getUserTournamentHistory({ userId: 'u-1', page: 2, limit: 5 });

    expect(userRepository.listMyTournamentHistory).toHaveBeenCalledWith({
      userId: 'u-1',
      page: 2,
      limit: 5,
    });
  });

  it('keeps newest-first ordering from repository results', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.listMyTournamentHistory.mockResolvedValue({
      items: [
        {
          tournamentId: 't-new',
          tournamentName: 'Newest',
          finalRank: 3,
          finalScore: 800,
          participantCount: 50,
          completedAt: '2026-06-03T00:00:00Z',
        },
        {
          tournamentId: 't-old',
          tournamentName: 'Older',
          finalRank: 8,
          finalScore: 400,
          participantCount: 60,
          completedAt: '2026-05-01T00:00:00Z',
        },
      ],
      total: 2,
    });

    const result = await service.getUserTournamentHistory({ userId: 'u-1', page: 1, limit: 20 });

    expect(result.items[0]?.tournamentId).toBe('t-new');
    expect(result.items[1]?.tournamentId).toBe('t-old');
  });

  it('returns completed tournaments only from repository results', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue({ userId: 'u-1' });
    userRepository.listMyTournamentHistory.mockResolvedValue({
      items: [
        {
          tournamentId: 't-finished',
          tournamentName: 'Finished',
          finalRank: 5,
          finalScore: 300,
          participantCount: 30,
          completedAt: '2026-05-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    const result = await service.getUserTournamentHistory({ userId: 'u-1', page: 1, limit: 20 });

    expect(result.items).toEqual([
      expect.objectContaining({ tournamentId: 't-finished' }),
    ]);
  });

  it('throws when user is not found', async () => {
    const { service, userRepository } = createService();
    userRepository.findMeById.mockResolvedValue(null);

    await expect(
      service.getUserTournamentHistory({ userId: 'missing', page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
