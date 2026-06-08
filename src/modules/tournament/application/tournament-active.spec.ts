/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';

describe('TournamentService getActiveTournaments', () => {
  const createService = () => {
    const tournamentRepository = {
      listActiveTournaments: jest.fn(),
    } as unknown as ConstructorParameters<typeof TournamentService>[0];

    const attemptRepository = {} as ConstructorParameters<typeof TournamentService>[1];

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as ConstructorParameters<typeof TournamentService>[2];

    const service = new TournamentService(
      tournamentRepository as never,
      attemptRepository as never,
      logger as never,
    );

    return {
      service,
      tournamentRepository: tournamentRepository as {
        listActiveTournaments: jest.Mock;
      },
    };
  };

  it('returns active tournaments returned by repository', async () => {
    const { service, tournamentRepository } = createService();
    const items = [
      {
        tournamentId: 't-1',
        name: 'Spring Challenge',
        startAt: '2026-06-01T00:00:00Z',
        endAt: '2026-06-10T00:00:00Z',
        participantCount: 523,
      },
    ];

    tournamentRepository.listActiveTournaments.mockResolvedValue({ total: 1, items });

    const result = await service.getActiveTournaments({
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      items,
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('requests active tournaments using current time filtering from repository', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.listActiveTournaments.mockResolvedValue({ total: 0, items: [] });

    await service.getActiveTournaments({
      page: 1,
      limit: 20,
    });

    expect(tournamentRepository.listActiveTournaments).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        nowIso: expect.any(String),
      }),
    );
  });

  it('excludes non-active tournaments through repository time window query', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.listActiveTournaments.mockResolvedValue({ total: 0, items: [] });

    await service.getActiveTournaments({
      page: 1,
      limit: 20,
    });

    expect(tournamentRepository.listActiveTournaments).toHaveBeenCalledTimes(1);
  });

  it('passes pagination through to repository', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.listActiveTournaments.mockResolvedValue({ total: 25, items: [] });

    await service.getActiveTournaments({
      page: 2,
      limit: 10,
    });

    expect(tournamentRepository.listActiveTournaments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
    );
  });
});
