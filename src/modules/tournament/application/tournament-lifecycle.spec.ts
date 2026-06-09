/// <reference types="jest" />
import { TournamentLifecycleService } from '../domain/tournament-lifecycle.service';

describe('TournamentLifecycleService', () => {
  const createService = () => {
    const tournamentRepository = {
      listTournamentsStartingSoon: jest.fn(),
      countParticipants: jest.fn(),
      markTournamentStatus: jest.fn(),
      listParticipants: jest.fn(),
      listCompletedTournaments: jest.fn(),
      finalizeTournament: jest.fn(),
    } as unknown as ConstructorParameters<typeof TournamentLifecycleService>[0];

    const eventBus = { publish: jest.fn() } as ConstructorParameters<typeof TournamentLifecycleService>[1];
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as ConstructorParameters<typeof TournamentLifecycleService>[2];

    const service = new TournamentLifecycleService(
      tournamentRepository as never,
      eventBus as never,
      logger as never,
    );

    return {
      service,
      tournamentRepository: tournamentRepository as {
        listTournamentsStartingSoon: jest.Mock;
        countParticipants: jest.Mock;
        markTournamentStatus: jest.Mock;
        listParticipants: jest.Mock;
        listCompletedTournaments: jest.Mock;
        finalizeTournament: jest.Mock;
      },
      eventBus: eventBus as { publish: jest.Mock },
    };
  };

  it('publishes starting soon notifications only after registration transition', async () => {
    const { service, tournamentRepository, eventBus } = createService();
    tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([
      {
        tournamentId: 't-1',
        title: 'Spring Challenge',
        startAt: '2026-07-01T00:00:00Z',
      },
    ]);
    tournamentRepository.countParticipants.mockResolvedValue(2);
    tournamentRepository.markTournamentStatus.mockResolvedValue({ tournamentId: 't-1', status: 'registration' });
    tournamentRepository.listParticipants.mockResolvedValue({
      items: [
        { userId: 'u-1', username: 'a', registeredAt: 'x' },
        { userId: 'u-2', username: 'b', registeredAt: 'x' },
      ],
      total: 2,
    });

    const published = await service.dispatchStartingSoonNotifications({
      windowStartIso: '2026-06-30T23:00:00Z',
      windowEndIso: '2026-07-01T00:00:00Z',
    });

    expect(published).toBe(2);
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });

  it('finalizes finished tournaments and emits completed plus won', async () => {
    const { service, tournamentRepository, eventBus } = createService();
    tournamentRepository.listCompletedTournaments.mockResolvedValue({
      items: [
        {
          tournamentId: 't-1',
          name: 'Spring Challenge',
          startAt: '2026-06-01T00:00:00Z',
          endAt: '2026-06-02T00:00:00Z',
          participantCount: 2,
        },
      ],
      total: 1,
    });
    tournamentRepository.markTournamentStatus.mockResolvedValue({
      tournamentId: 't-1',
      title: 'Spring Challenge',
      prize: '100 coins',
      status: 'finished',
    });
    tournamentRepository.finalizeTournament.mockResolvedValue([
      { userId: 'u-1', rank: 1, totalParticipants: 2 },
      { userId: 'u-2', rank: 2, totalParticipants: 2 },
    ]);

    const finalized = await service.finalizeDueTournaments('2026-06-02T00:00:01Z');

    expect(finalized).toBe(1);
    expect(tournamentRepository.finalizeTournament).toHaveBeenCalledWith({
      tournamentId: 't-1',
      nowIso: '2026-06-02T00:00:01Z',
    });
    expect(eventBus.publish).toHaveBeenCalledTimes(3);
  });
});
