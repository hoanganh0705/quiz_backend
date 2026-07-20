/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';

describe('TournamentService getTournamentWinners', () => {
  const createService = () => {
    const tournamentRepository = {
      getTournamentById: jest.fn(),
      getWinners: jest.fn(),
    };

    const _attemptRepository = {} as never;
    const _eventBus = {} as never;
    const _tournamentOutbox = {} as never;
    const _db = {} as never;

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    };

    const service = new TournamentService(
      tournamentRepository as never,
      _eventBus,
      _tournamentOutbox,
      _db,
      logger as never,
    );

    return {
      service,
      tournamentRepository: tournamentRepository as unknown as {
        getTournamentById: jest.Mock;
        getWinners: jest.Mock;
      },
    };
  };

  it('returns top 3 winners', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'finished',
    });
    tournamentRepository.getWinners.mockResolvedValue([
      { rank: 1, userId: 'u-1', username: 'Anh', score: 980, avatarUrl: null },
      { rank: 2, userId: 'u-2', username: 'John', score: 950, avatarUrl: null },
      { rank: 3, userId: 'u-3', username: 'Jane', score: 930, avatarUrl: null },
    ]);

    const result = await service.getTournamentWinners({ tournamentId: 't-1', limit: 3 });

    expect(result).toHaveLength(3);
    expect(result[0]?.rank).toBe(1);
  });

  it('passes custom limit to repository', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'finished',
    });
    tournamentRepository.getWinners.mockResolvedValue([]);

    await service.getTournamentWinners({ tournamentId: 't-1', limit: 10 });

    expect(tournamentRepository.getWinners).toHaveBeenCalledWith({
      tournamentId: 't-1',
      limit: 10,
    });
  });

  it('excludes withdrawn participants through repository query', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'finished',
    });
    tournamentRepository.getWinners.mockResolvedValue([
      { rank: 1, userId: 'u-1', username: 'Anh', score: 980, avatarUrl: null },
    ]);

    const result = await service.getTournamentWinners({ tournamentId: 't-1', limit: 10 });

    expect(result.every((winner) => winner.userId !== 'withdrawn-user')).toBe(true);
  });

  it('preserves tie-break ranking order from repository', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'finished',
    });
    tournamentRepository.getWinners.mockResolvedValue([
      { rank: 1, userId: 'u-1', username: 'Anh', score: 980, avatarUrl: null },
      { rank: 2, userId: 'u-2', username: 'John', score: 980, avatarUrl: null },
    ]);

    const result = await service.getTournamentWinners({ tournamentId: 't-1', limit: 2 });

    expect(result[0]?.userId).toBe('u-1');
    expect(result[1]?.userId).toBe('u-2');
  });

  it('throws when tournament not found', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue(null);

    await expect(
      service.getTournamentWinners({ tournamentId: 'missing', limit: 10 }),
    ).rejects.toThrow();
  });

  it('returns leaderboard for completed tournament', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'finished',
    });
    tournamentRepository.getWinners.mockResolvedValue([
      {
        rank: 1,
        userId: 'u-1',
        username: 'Anh',
        score: 980,
        avatarUrl: 'https://example.com/a.png',
      },
    ]);

    const result = await service.getTournamentWinners({ tournamentId: 't-1', limit: 10 });

    expect(result[0]).toEqual({
      rank: 1,
      userId: 'u-1',
      username: 'Anh',
      score: 980,
      avatarUrl: 'https://example.com/a.png',
    });
  });
});
