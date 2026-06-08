/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';

describe('TournamentService getUpcomingTournaments', () => {
  const createService = () => {
    const tournamentRepository = {
      listUpcomingTournaments: jest.fn(),
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
        listUpcomingTournaments: jest.Mock;
      },
    };
  };

  it('returns upcoming tournaments returned by repository', async () => {
    const { service, tournamentRepository } = createService();
    const items = [
      {
        tournamentId: 't-1',
        name: 'Spring Challenge',
        description: 'Upcoming event',
        startAt: '2026-07-01T00:00:00Z',
        endAt: '2026-07-10T00:00:00Z',
        participantCount: 523,
      },
    ];

    tournamentRepository.listUpcomingTournaments.mockResolvedValue({ total: 1, items });

    const result = await service.getUpcomingTournaments({
      page: 1,
      limit: 20,
      sortBy: 'startAt',
    });

    expect(result).toEqual({
      items,
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('requests upcoming tournaments using current time filtering from repository', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.listUpcomingTournaments.mockResolvedValue({ total: 1, items: [] });

    await service.getUpcomingTournaments({
      page: 1,
      limit: 20,
      sortBy: 'startAt',
    });

    expect(tournamentRepository.listUpcomingTournaments).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: 'startAt',
        nowIso: expect.any(String),
      }),
    );
  });

  it('supports alternate sorting by registrationDeadline', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.listUpcomingTournaments.mockResolvedValue({ total: 0, items: [] });

    await service.getUpcomingTournaments({
      page: 1,
      limit: 20,
      sortBy: 'registrationDeadline',
    });

    expect(tournamentRepository.listUpcomingTournaments).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'registrationDeadline' }),
    );
  });

  it('passes pagination through to repository', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.listUpcomingTournaments.mockResolvedValue({ total: 25, items: [] });

    await service.getUpcomingTournaments({
      page: 2,
      limit: 10,
      sortBy: 'startAt',
    });

    expect(tournamentRepository.listUpcomingTournaments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
    );
  });
});
