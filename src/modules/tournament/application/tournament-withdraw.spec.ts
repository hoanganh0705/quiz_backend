/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';
import {
  TournamentAlreadyWithdrawnError,
  TournamentForbiddenError,
  TournamentWithdrawClosedError,
} from '../domain/errors';

describe('TournamentService withdrawFromTournament', () => {
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
      getTournamentById: jest.fn(),
      getParticipantByUserAndTournament: jest.fn(),
      withdrawParticipant: jest.fn(),
      getParticipantStanding: jest.fn(),
    };

    const eventBus = {} as never;
    const tournamentOutbox = {
      scheduleTournamentEvent: jest.fn().mockResolvedValue(undefined),
    };

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
      eventBus,
      tournamentOutbox as never,
      db as never,
      logger as never,
    );

    return {
      service,
      tournamentRepository,
      tournamentOutbox,
      db,
      mockTx,
      logger,
    };
  };

  it('withdraws successfully and schedules event to outbox', async () => {
    const { service, tournamentRepository, tournamentOutbox, db } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'ongoing',
    });
    tournamentRepository.getParticipantByUserAndTournament.mockResolvedValue({
      participantId: 'p-1',
      tournamentId: 't-1',
      userId: 'u-1',
      status: 'active',
    });
    tournamentRepository.withdrawParticipant.mockResolvedValue({
      participantId: 'p-1',
      tournamentId: 't-1',
      userId: 'u-1',
      status: 'withdrawn',
      withdrawnAt: '2026-06-08T10:00:00Z',
      updatedAt: '2026-06-08T10:00:00Z',
    });

    const result = await service.withdrawFromTournament({ tournamentId: 't-1', userId: 'u-1' });

    expect(result.status).toBe('withdrawn');
    expect(result.withdrawnAt).toBe('2026-06-08T10:00:00Z');
    expect(db.transaction).toHaveBeenCalled();
    expect(tournamentOutbox.scheduleTournamentEvent).toHaveBeenCalled();
  });

  it('throws for non participant withdrawal', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'ongoing',
    });
    tournamentRepository.getParticipantByUserAndTournament.mockResolvedValue(null);

    await expect(
      service.withdrawFromTournament({ tournamentId: 't-1', userId: 'u-1' }),
    ).rejects.toBeInstanceOf(TournamentForbiddenError);
  });

  it('throws for already withdrawn participant', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'ongoing',
    });
    tournamentRepository.getParticipantByUserAndTournament.mockResolvedValue({
      participantId: 'p-1',
      tournamentId: 't-1',
      userId: 'u-1',
      status: 'withdrawn',
    });

    await expect(
      service.withdrawFromTournament({ tournamentId: 't-1', userId: 'u-1' }),
    ).rejects.toBeInstanceOf(TournamentAlreadyWithdrawnError);
  });

  it('throws when tournament is completed', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'finished',
    });

    await expect(
      service.withdrawFromTournament({ tournamentId: 't-1', userId: 'u-1' }),
    ).rejects.toBeInstanceOf(TournamentWithdrawClosedError);
  });

  it('excludes withdrawn participant from ranking calculations', async () => {
    const { service, tournamentRepository } = createService();
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'ongoing',
    });
    tournamentRepository.getParticipantByUserAndTournament.mockResolvedValue({
      participantId: 'p-1',
      tournamentId: 't-1',
      userId: 'u-1',
      status: 'withdrawn',
    });

    await expect(
      service.getMyTournamentStanding({ tournamentId: 't-1', userId: 'u-1' }),
    ).rejects.toBeInstanceOf(TournamentForbiddenError);
  });
});
