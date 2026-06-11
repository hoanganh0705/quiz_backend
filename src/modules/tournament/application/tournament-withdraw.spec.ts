/// <reference types="jest" />
import { TournamentService } from '../domain/tournament.service';
import {
  TournamentAlreadyWithdrawnError,
  TournamentForbiddenError,
  TournamentWithdrawClosedError,
} from '../domain/errors';

describe('TournamentService withdrawFromTournament', () => {
  const createService = () => {
    const tournamentRepository = {
      getTournamentById: jest.fn(),
      getParticipantByUserAndTournament: jest.fn(),
      withdrawParticipant: jest.fn(),
      getParticipantStanding: jest.fn(),
    } as unknown as ConstructorParameters<typeof TournamentService>[0];

    const attemptRepository = {} as ConstructorParameters<typeof TournamentService>[1];
    const eventBus = { publish: jest.fn() } as unknown as ConstructorParameters<
      typeof TournamentService
    >[2];

    const service = new TournamentService(
      tournamentRepository as never,
      attemptRepository as never,
      eventBus as never,
    );

    return {
      service,
      eventBus: eventBus as unknown as { publish: jest.Mock },
      tournamentRepository: tournamentRepository as unknown as {
        getTournamentById: jest.Mock;
        getParticipantByUserAndTournament: jest.Mock;
        withdrawParticipant: jest.Mock;
        getParticipantStanding: jest.Mock;
      },
    };
  };

  it('withdraws successfully', async () => {
    const { service, tournamentRepository } = createService();
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

  it('publishes withdrawal event', async () => {
    const { service, tournamentRepository, eventBus } = createService();
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

    await service.withdrawFromTournament({ tournamentId: 't-1', userId: 'u-1' });

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
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
