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
      listTournamentsStartingPlay: jest.fn(),
      countParticipants: jest.fn(),
      markTournamentStatus: jest.fn(),
      listParticipants: jest.fn(),
      listCompletedTournaments: jest.fn(),
      finalizeTournament: jest.fn(),
      listDueRoundOpens: jest.fn(),
      listDueRoundCloses: jest.fn(),
      markRoundStatus: jest.fn(),
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

  describe('startDueTournaments', () => {
    it('transitions registration tournaments whose startAt has passed to ongoing', async () => {
      const { service, tournamentRepository, logger } = createService();
      tournamentRepository.listTournamentsStartingPlay.mockResolvedValue([
        {
          tournamentId: 't-1',
          title: 'Spring Challenge',
          status: 'registration',
          startAt: '2026-07-01T00:00:00Z',
        },
        {
          tournamentId: 't-2',
          title: 'Summer Cup',
          status: 'registration',
          startAt: '2026-07-01T00:00:00Z',
        },
      ]);
      tournamentRepository.markTournamentStatus
        .mockResolvedValueOnce({
          tournamentId: 't-1',
          status: 'ongoing',
        })
        .mockResolvedValueOnce({
          tournamentId: 't-2',
          status: 'ongoing',
        });

      const transitioned = await service.startDueTournaments('2026-07-01T00:05:00Z');

      expect(transitioned).toBe(2);
      expect(tournamentRepository.listTournamentsStartingPlay).toHaveBeenCalledWith({
        nowIso: '2026-07-01T00:05:00Z',
      });
      expect(tournamentRepository.markTournamentStatus).toHaveBeenCalledTimes(2);
      expect(tournamentRepository.markTournamentStatus).toHaveBeenNthCalledWith(1, {
        tournamentId: 't-1',
        fromStatus: 'registration',
        toStatus: 'ongoing',
        nowIso: '2026-07-01T00:05:00Z',
      });
      expect(tournamentRepository.markTournamentStatus).toHaveBeenNthCalledWith(2, {
        tournamentId: 't-2',
        fromStatus: 'registration',
        toStatus: 'ongoing',
        nowIso: '2026-07-01T00:05:00Z',
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'tournaments_started', transitioned: 2 }),
      );
    });

    it('returns 0 when no registration tournaments are due', async () => {
      const { service, tournamentRepository, logger } = createService();
      tournamentRepository.listTournamentsStartingPlay.mockResolvedValue([]);

      const transitioned = await service.startDueTournaments('2026-07-01T00:00:00Z');

      expect(transitioned).toBe(0);
      expect(tournamentRepository.markTournamentStatus).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'tournaments_started', transitioned: 0 }),
      );
    });

    it('skips tournaments where the guard rejected the transition (concurrent winner)', async () => {
      const { service, tournamentRepository, logger } = createService();
      tournamentRepository.listTournamentsStartingPlay.mockResolvedValue([
        { tournamentId: 't-1', status: 'registration', startAt: '2026-07-01T00:00:00Z' },
        { tournamentId: 't-2', status: 'registration', startAt: '2026-07-01T00:00:00Z' },
      ]);
      // t-1 wins the race (already moved by another replica), t-2 is ours.
      tournamentRepository.markTournamentStatus
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ tournamentId: 't-2', status: 'ongoing' });

      const transitioned = await service.startDueTournaments('2026-07-01T00:00:00Z');

      expect(transitioned).toBe(1); // only t-2 counted
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'tournaments_started', transitioned: 1 }),
      );
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

  describe('openDueRounds', () => {
    it('transitions all due pending rounds to open in a single page', async () => {
      const { service, tournamentRepository, logger } = createService();
      tournamentRepository.listDueRoundOpens.mockResolvedValueOnce({
        items: [
          { roundId: 'r-1', status: 'pending' },
          { roundId: 'r-2', status: 'pending' },
        ],
        total: 2,
      });
      tournamentRepository.markRoundStatus.mockResolvedValue({
        roundId: 'r-1',
        status: 'open',
      } as never);

      const opened = await service.openDueRounds('2026-07-15T00:00:00Z');

      expect(opened).toBe(2);
      expect(tournamentRepository.listDueRoundOpens).toHaveBeenCalledTimes(1);
      expect(tournamentRepository.listDueRoundOpens).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        nowIso: '2026-07-15T00:00:00Z',
      });
      expect(tournamentRepository.markRoundStatus).toHaveBeenCalledTimes(2);
      expect(tournamentRepository.markRoundStatus).toHaveBeenNthCalledWith(1, {
        roundId: 'r-1',
        fromStatus: 'pending',
        toStatus: 'open',
        nowIso: '2026-07-15T00:00:00Z',
      });
      expect(tournamentRepository.markRoundStatus).toHaveBeenNthCalledWith(2, {
        roundId: 'r-2',
        fromStatus: 'pending',
        toStatus: 'open',
        nowIso: '2026-07-15T00:00:00Z',
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'rounds_opened', opened: 2 }),
      );
    });

    it('paginates across multiple pages until empty', async () => {
      const { service, tournamentRepository } = createService();
      // Page 1: full 100-rounds page → loop continues.
      // Page 2: short page (50) → loop terminates.
      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        roundId: `r-page1-${i}`,
        status: 'pending',
      }));
      const shortPage = Array.from({ length: 50 }, (_, i) => ({
        roundId: `r-page2-${i}`,
        status: 'pending',
      }));
      tournamentRepository.listDueRoundOpens
        .mockResolvedValueOnce({ items: fullPage, total: 150 })
        .mockResolvedValueOnce({ items: shortPage, total: 150 });
      tournamentRepository.markRoundStatus.mockResolvedValue({
        roundId: 'r-x',
        status: 'open',
      } as never);

      const opened = await service.openDueRounds('2026-07-15T00:00:00Z');

      expect(opened).toBe(150);
      expect(tournamentRepository.listDueRoundOpens).toHaveBeenCalledTimes(2);
      // Second call should request page=2.
      expect(tournamentRepository.listDueRoundOpens).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ page: 2 }),
      );
    });

    it('returns 0 and skips markRoundStatus when no due rounds exist', async () => {
      const { service, tournamentRepository, logger } = createService();
      tournamentRepository.listDueRoundOpens.mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      const opened = await service.openDueRounds('2026-07-15T00:00:00Z');

      expect(opened).toBe(0);
      expect(tournamentRepository.markRoundStatus).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'rounds_opened', opened: 0 }),
      );
    });

    it('does not count rounds where the guard rejected the transition (concurrent winner)', async () => {
      const { service, tournamentRepository } = createService();
      tournamentRepository.listDueRoundOpens.mockResolvedValueOnce({
        items: [
          { roundId: 'r-1', status: 'pending' },
          { roundId: 'r-2', status: 'pending' },
        ],
        total: 2,
      });
      // r-1 wins the race, r-2 loses (already moved by a concurrent caller).
      tournamentRepository.markRoundStatus
        .mockResolvedValueOnce({ roundId: 'r-1', status: 'open' } as never)
        .mockResolvedValueOnce(null);

      const opened = await service.openDueRounds('2026-07-15T00:00:00Z');

      expect(opened).toBe(1);
    });
  });

  describe('closeDueRounds', () => {
    it('transitions all due open rounds to finished in a single page', async () => {
      const { service, tournamentRepository, logger } = createService();
      tournamentRepository.listDueRoundCloses.mockResolvedValueOnce({
        items: [
          { roundId: 'r-1', status: 'open' },
          { roundId: 'r-2', status: 'open' },
        ],
        total: 2,
      });
      tournamentRepository.markRoundStatus.mockResolvedValue({
        roundId: 'r-1',
        status: 'finished',
      } as never);

      const closed = await service.closeDueRounds('2026-07-15T00:00:00Z');

      expect(closed).toBe(2);
      expect(tournamentRepository.listDueRoundCloses).toHaveBeenCalledTimes(1);
      expect(tournamentRepository.listDueRoundCloses).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        nowIso: '2026-07-15T00:00:00Z',
      });
      expect(tournamentRepository.markRoundStatus).toHaveBeenCalledTimes(2);
      expect(tournamentRepository.markRoundStatus).toHaveBeenNthCalledWith(1, {
        roundId: 'r-1',
        fromStatus: 'open',
        toStatus: 'finished',
        nowIso: '2026-07-15T00:00:00Z',
      });
      expect(tournamentRepository.markRoundStatus).toHaveBeenNthCalledWith(2, {
        roundId: 'r-2',
        fromStatus: 'open',
        toStatus: 'finished',
        nowIso: '2026-07-15T00:00:00Z',
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'rounds_closed', closed: 2 }),
      );
    });

    it('terminates pagination after a short final page', async () => {
      const { service, tournamentRepository } = createService();
      tournamentRepository.listDueRoundCloses
        .mockResolvedValueOnce({
          items: Array.from({ length: 100 }, (_, i) => ({
            roundId: `r-page1-${i}`,
            status: 'open',
          })),
          total: 105,
        })
        .mockResolvedValueOnce({
          items: Array.from({ length: 5 }, (_, i) => ({
            roundId: `r-page2-${i}`,
            status: 'open',
          })),
          total: 105,
        });
      tournamentRepository.markRoundStatus.mockResolvedValue({} as never);

      const closed = await service.closeDueRounds('2026-07-15T00:00:00Z');

      expect(closed).toBe(105);
      expect(tournamentRepository.listDueRoundCloses).toHaveBeenCalledTimes(2);
      expect(tournamentRepository.listDueRoundCloses).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ page: 2 }),
      );
    });

    it('returns 0 when no open rounds are due', async () => {
      const { service, tournamentRepository } = createService();
      tournamentRepository.listDueRoundCloses.mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      const closed = await service.closeDueRounds('2026-07-15T00:00:00Z');

      expect(closed).toBe(0);
      expect(tournamentRepository.markRoundStatus).not.toHaveBeenCalled();
    });
  });
});
