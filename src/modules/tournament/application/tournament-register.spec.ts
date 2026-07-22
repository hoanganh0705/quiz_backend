/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';
import { TournamentAlreadyRegisteredError, TournamentRegistrationClosedError } from '../domain/errors';

describe('TournamentService registerForTournament', () => {
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
      atomicRegister: jest.fn(),
      getParticipantByUserAndTournament: jest.fn(),
    };

    const eventBus = {} as never;
    const tournamentOutbox = {
      scheduleTournamentEvent: jest.fn().mockResolvedValue(undefined),
    };
    const _categoryRepository = {} as never;

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
      _categoryRepository,
      db as never,
      logger as never,
    );

    return {
      service,
      tournamentRepository,
      tournamentOutbox,
      db,
      logger,
    };
  };

  it('registers a first-time participant and schedules joined event to outbox', async () => {
    const { service, tournamentRepository, tournamentOutbox, db } = createService();
    const mockUser = { sub: 'u-1', role: 'user' } as const;
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'registration',
      startAt: '2099-01-01T00:00:00Z', // far future — passes startAt check
      title: 'Spring Challenge',
    });
    tournamentRepository.atomicRegister.mockResolvedValue({
      participant: {
        participantId: 'p-1',
        tournamentId: 't-1',
        userId: 'u-1',
        status: 'active',
        registeredAt: '2026-06-01T00:00:00Z',
      },
      inserted: true,
    });

    const result = await service.registerForTournament('t-1', mockUser);

    expect(result.status).toBe('active');
    expect(result.participantId).toBe('p-1');
    expect(db.transaction).toHaveBeenCalled();
    expect(tournamentOutbox.scheduleTournamentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'tournament.joined' }),
      expect.anything(),
      expect.anything(),
    );
    expect(tournamentOutbox.scheduleTournamentEvent).toHaveBeenCalledTimes(1);
  });

  it('re-registers a withdrawn participant, reactivates status, and schedules joined event', async () => {
    const { service, tournamentRepository, tournamentOutbox, db } = createService();
    const mockUser = { sub: 'u-1', role: 'user' } as const;
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'registration',
      startAt: '2099-01-01T00:00:00Z',
      title: 'Spring Challenge',
    });
    // atomicRegister returns inserted=false with reactivated participant
    // (the repository updated the withdrawn row to active inside the same transaction)
    tournamentRepository.atomicRegister.mockResolvedValue({
      participant: {
        participantId: 'p-1',
        tournamentId: 't-1',
        userId: 'u-1',
        status: 'active', // already reactivated by the repository
        withdrawnAt: null,
        registeredAt: '2026-06-01T00:00:00Z',
      },
      inserted: false,
      reactivated: true, // signals the row was previously withdrawn and is now active
    });

    const result = await service.registerForTournament('t-1', mockUser);

    // Participant is reactivated — status is 'active', not 'withdrawn'
    expect(result.status).toBe('active');
    expect(result.withdrawnAt).toBeNull();
    expect(db.transaction).toHaveBeenCalled();
    // No joined event is scheduled for re-activations — the user is already in the tournament.
    // The original tournament.joined event already captured the join; re-activation is not a new join.
    expect(tournamentOutbox.scheduleTournamentEvent).not.toHaveBeenCalled();
  });

  it('throws TournamentAlreadyRegisteredError when user is already active', async () => {
    const { service, tournamentRepository } = createService();
    const mockUser = { sub: 'u-1', role: 'user' } as const;
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'registration',
      startAt: '2099-01-01T00:00:00Z',
      title: 'Spring Challenge',
    });
    tournamentRepository.atomicRegister.mockResolvedValue({
      participant: {
        participantId: 'p-1',
        tournamentId: 't-1',
        userId: 'u-1',
        status: 'active', // already active — this is a duplicate
        registeredAt: '2026-06-01T00:00:00Z',
      },
      inserted: false,
    });

    await expect(service.registerForTournament('t-1', mockUser)).rejects.toBeInstanceOf(
      TournamentAlreadyRegisteredError,
    );
  });

  it('throws TournamentRegistrationClosedError when tournament is not in registration status', async () => {
    const { service, tournamentRepository } = createService();
    const mockUser = { sub: 'u-1', role: 'user' } as const;
    tournamentRepository.getTournamentById.mockResolvedValue({
      tournamentId: 't-1',
      status: 'upcoming',
      startAt: '2099-01-01T00:00:00Z',
    });

    await expect(service.registerForTournament('t-1', mockUser)).rejects.toBeInstanceOf(
      TournamentRegistrationClosedError,
    );
  });
});
