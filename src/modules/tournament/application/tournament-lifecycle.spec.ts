/// <reference types="jest" />
import { TournamentLifecycleService } from '../domain/tournament-lifecycle.service';

describe('TournamentLifecycleService', () => {
  const createService = () => {
    const mockTx = {
      select: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      execute: jest.fn(),
    };

    const db = {
      transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    };

    const tournamentRepository = {
      listTournamentsStartingSoon: jest.fn(),
      countParticipants: jest.fn(),
      markTournamentStatus: jest.fn(),
      listParticipants: jest.fn(),
      listCompletedTournaments: jest.fn(),
      finalizeTournament: jest.fn(),
    };

    const tournamentOutbox = {
      scheduleTournamentEvent: jest.fn().mockResolvedValue(undefined),
    };

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const service = new TournamentLifecycleService(
      tournamentRepository as never,
      tournamentOutbox as never,
      db as never,
      logger as never,
    );

    return {
      service,
      tournamentRepository,
      tournamentOutbox,
      db,
      logger,
      mockTx,
    };
  };

  describe('dispatchStartingSoonNotifications', () => {
    it('schedules starting soon notifications after registration transition', async () => {
      const { service, tournamentRepository, tournamentOutbox } = createService();
      tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([
        {
          tournamentId: 't-1',
          title: 'Spring Challenge',
          startAt: '2026-07-01T00:00:00Z',
        },
      ]);
      tournamentRepository.countParticipants.mockResolvedValue(2);
      tournamentRepository.markTournamentStatus.mockResolvedValue({
        tournamentId: 't-1',
        status: 'registration',
      });
      tournamentRepository.listParticipants.mockResolvedValue({
        items: [
          { userId: 'u-1', username: 'a', registeredAt: 'x' },
          { userId: 'u-2', username: 'b', registeredAt: 'x' },
        ],
        total: 2,
      });

      const scheduled = await service.dispatchStartingSoonNotifications({
        windowStartIso: '2026-06-30T23:00:00Z',
        windowEndIso: '2026-07-01T00:00:00Z',
      });

      expect(scheduled).toBe(2);
      expect(tournamentOutbox.scheduleTournamentEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('finalizeDueTournaments', () => {
    it('finalizes tournament and schedules events to outbox', async () => {
      const { service, tournamentRepository, tournamentOutbox } = createService();
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

      // Mock markTournamentStatus inside transaction
      tournamentRepository.markTournamentStatus.mockResolvedValue({
        tournamentId: 't-1',
        title: 'Spring Challenge',
        prize: '100 coins',
        status: 'finished',
      });

      // Mock finalizeTournament inside transaction
      tournamentRepository.finalizeTournament.mockResolvedValue([
        { userId: 'u-1', rank: 1, totalParticipants: 2 },
        { userId: 'u-2', rank: 2, totalParticipants: 2 },
      ]);

      const finalized = await service.finalizeDueTournaments('2026-06-02T00:00:01Z');

      expect(finalized).toBe(1);
      expect(tournamentRepository.markTournamentStatus).toHaveBeenCalled();
      expect(tournamentRepository.finalizeTournament).toHaveBeenCalled();

      // Should schedule tournament.completed events for all participants
      expect(tournamentOutbox.scheduleTournamentEvent).toHaveBeenCalledTimes(3);
    });

    it('skips tournaments that are already finished', async () => {
      const { service, tournamentRepository, tournamentOutbox } = createService();
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

      // Tournament is already finished
      tournamentRepository.markTournamentStatus.mockResolvedValue(null);

      const finalized = await service.finalizeDueTournaments('2026-06-02T00:00:01Z');

      expect(finalized).toBe(0);
      expect(tournamentRepository.finalizeTournament).not.toHaveBeenCalled();
      expect(tournamentOutbox.scheduleTournamentEvent).not.toHaveBeenCalled();
    });
  });
});
