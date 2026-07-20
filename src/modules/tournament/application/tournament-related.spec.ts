/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';

describe('TournamentService getRelatedTournaments', () => {
  const createService = () => {
    const tournamentRepository = {
      getTournamentById: jest.fn(),
      listRelatedTournaments: jest.fn(),
    };

    const _attemptRepository = {} as never;
    const _eventBus = {} as never;
    const _tournamentOutbox = {} as never;
    const _db = {} as never;

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
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
        listRelatedTournaments: jest.Mock;
      },
    };
  };

  it('returns related tournaments from repository', async () => {
    const { service, tournamentRepository } = createService();
    const items = [
      {
        tournamentId: 't-2',
        name: 'Backend Challenge',
        startAt: '2026-07-01T00:00:00Z',
        participantCount: 312,
      },
    ];

    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      title: 'Frontend Challenge',
      description: 'Web development contest',
      categoryId: 'cat-1',
    });
    tournamentRepository.listRelatedTournaments.mockResolvedValue(items);

    const result = await service.getRelatedTournaments({
      tournamentId: 't-1',
      limit: 5,
    });

    expect(result).toEqual([
      {
        tournamentId: 't-2',
        name: 'Backend Challenge',
        startAt: '2026-07-01T00:00:00Z',
        participantCount: 312,
      },
    ]);
  });

  it('excludes current tournament via repository filter', async () => {
    const { service, tournamentRepository } = createService();

    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      title: 'Challenge',
      categoryId: null,
    });
    tournamentRepository.listRelatedTournaments.mockResolvedValue([]);

    await service.getRelatedTournaments({
      tournamentId: 't-1',
      limit: 5,
    });

    expect(tournamentRepository.listRelatedTournaments).toHaveBeenCalledWith({
      tournamentId: 't-1',
      limit: 5,
    });
  });

  it('respects limit parameter', async () => {
    const { service, tournamentRepository } = createService();

    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      title: 'Challenge',
      categoryId: null,
    });
    tournamentRepository.listRelatedTournaments.mockResolvedValue([]);

    await service.getRelatedTournaments({
      tournamentId: 't-1',
      limit: 3,
    });

    expect(tournamentRepository.listRelatedTournaments).toHaveBeenCalledWith({
      tournamentId: 't-1',
      limit: 3,
    });
  });

  it('throws not found error when tournament does not exist', async () => {
    const { service, tournamentRepository } = createService();

    tournamentRepository.getTournamentById.mockResolvedValue(null);
    tournamentRepository.listRelatedTournaments.mockResolvedValue([]);

    await expect(
      service.getRelatedTournaments({
        tournamentId: 'nonexistent',
        limit: 5,
      }),
    ).rejects.toThrow();
  });
});
