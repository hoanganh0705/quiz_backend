/* eslint-disable @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { TournamentLifecycleService } from './tournament-lifecycle.service';
import type { TournamentRepositoryPort } from './ports';
import type { TournamentOutboxPort } from './ports/tournament-outbox.port';
import type { DrizzleDB } from '@/core/database/database.module';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

describe('TournamentLifecycleService', () => {
  let service: TournamentLifecycleService;
  let tournamentRepository: jest.Mocked<TournamentRepositoryPort>;
  let tournamentOutbox: jest.Mocked<TournamentOutboxPort>;
  let db: DrizzleDB;

  beforeEach(() => {
    tournamentRepository = {
      listTournamentsStartingSoon: jest.fn(),
      listTournamentsStartingPlay: jest.fn(),
      listCompletedTournaments: jest.fn(),
      listDueRoundOpens: jest.fn(),
      listDueRoundCloses: jest.fn(),
      finalizeTournament: jest.fn(),
      markTournamentStatus: jest.fn(),
      markRoundStatus: jest.fn(),
      countParticipants: jest.fn(),
      listParticipants: jest.fn(),
    } as unknown as jest.Mocked<TournamentRepositoryPort>;

    tournamentOutbox = {
      scheduleTournamentEvent: jest.fn(),
      scheduleTournamentEventsBatch: jest.fn(),
    } as unknown as jest.Mocked<TournamentOutboxPort>;

    db = {} as DrizzleDB;

    service = new TournamentLifecycleService(
      tournamentRepository,
      tournamentOutbox,
      db,
      makeLogger(),
    );
  });

  describe('dispatchStartingSoonNotifications', () => {
    const windowStartIso = '2026-01-01T00:00:00.000Z';
    const windowEndIso = '2026-01-01T00:10:00.000Z';

    it('returns 0 when no tournaments are starting soon', async () => {
      tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([]);

      const result = await service.dispatchStartingSoonNotifications({
        windowStartIso,
        windowEndIso,
      });

      expect(result).toBe(0);
      expect(tournamentOutbox.scheduleTournamentEventsBatch).not.toHaveBeenCalled();
    });

    it('skips tournaments with zero participants', async () => {
      tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([
        {
          tournamentId: 't-1',
          title: 'T1',
          description: null,
          difficulty: 'medium',
          status: 'upcoming',
          prize: null,
          startAt: '2026-01-01T01:00:00.000Z',
          endAt: '2026-01-01T02:00:00.000Z',
          maxParticipants: 100,
          categoryId: null,
          ownerUserId: 'owner-1',
          createdAt: '2025-12-31T00:00:00.000Z',
          updatedAt: '2025-12-31T00:00:00.000Z',
          deletedAt: null,
        },
      ]);
      tournamentRepository.countParticipants.mockResolvedValue(0);

      const result = await service.dispatchStartingSoonNotifications({
        windowStartIso,
        windowEndIso,
      });

      expect(result).toBe(0);
      expect(tournamentOutbox.scheduleTournamentEventsBatch).not.toHaveBeenCalled();
    });

    it('fans out a batch with one event per participant (not N+1)', async () => {
      tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([
        {
          tournamentId: 't-1',
          title: 'Big Tournament',
          description: 'A tournament',
          difficulty: 'hard',
          status: 'upcoming',
          prize: null,
          startAt: '2026-01-01T01:00:00.000Z',
          endAt: '2026-01-01T02:00:00.000Z',
          maxParticipants: 10_000,
          categoryId: null,
          ownerUserId: 'owner-1',
          createdAt: '2025-12-31T00:00:00.000Z',
          updatedAt: '2025-12-31T00:00:00.000Z',
          deletedAt: null,
        },
      ]);
      tournamentRepository.countParticipants.mockResolvedValue(10_000);
      tournamentRepository.markTournamentStatus.mockResolvedValue({
        tournamentId: 't-1',
        title: 'Big Tournament',
        description: 'A tournament',
        difficulty: 'hard',
        status: 'registration',
        prize: null,
        startAt: '2026-01-01T01:00:00.000Z',
        endAt: '2026-01-01T02:00:00.000Z',
        maxParticipants: 10_000,
        categoryId: null,
        ownerUserId: 'owner-1',
        createdAt: '2025-12-31T00:00:00.000Z',
        updatedAt: '2025-12-31T00:00:00.000Z',
        deletedAt: null,
      });
      const participants = Array.from({ length: 10_000 }, (_, i) => ({
        userId: `user-${i}`,
        username: `user_${i}`,
        registeredAt: '2025-12-30T00:00:00.000Z',
      }));
      tournamentRepository.listParticipants.mockResolvedValue({
        items: participants,
        total: 10_000,
      });

      const result = await service.dispatchStartingSoonNotifications({
        windowStartIso,
        windowEndIso,
      });

      expect(result).toBe(10_000);
      expect(tournamentOutbox.scheduleTournamentEventsBatch).toHaveBeenCalledTimes(1);
      expect(tournamentOutbox.scheduleTournamentEventsBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'tournament.starting_soon',
            idempotencyKey: 'tournament:starting_soon:t-1:user-0',
          }),
        ]),
        db,
        expect.any(String),
      );
      const eventsArg = tournamentOutbox.scheduleTournamentEventsBatch.mock
        .calls[0][0] as unknown as Array<{ idempotencyKey: string }>;
      expect(eventsArg).toHaveLength(10_000);
    });

    it('never calls the per-event scheduleTournamentEvent API', async () => {
      tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([
        {
          tournamentId: 't-2',
          title: 'Small',
          description: null,
          difficulty: 'easy',
          status: 'upcoming',
          prize: null,
          startAt: '2026-01-01T01:00:00.000Z',
          endAt: '2026-01-01T02:00:00.000Z',
          maxParticipants: 5,
          categoryId: null,
          ownerUserId: 'owner-1',
          createdAt: '2025-12-31T00:00:00.000Z',
          updatedAt: '2025-12-31T00:00:00.000Z',
          deletedAt: null,
        },
      ]);
      tournamentRepository.countParticipants.mockResolvedValue(2);
      tournamentRepository.markTournamentStatus.mockResolvedValue({
        tournamentId: 't-2',
        title: 'Small',
        description: null,
        difficulty: 'easy',
        status: 'registration',
        prize: null,
        startAt: '2026-01-01T01:00:00.000Z',
        endAt: '2026-01-01T02:00:00.000Z',
        maxParticipants: 5,
        categoryId: null,
        ownerUserId: 'owner-1',
        createdAt: '2025-12-31T00:00:00.000Z',
        updatedAt: '2025-12-31T00:00:00.000Z',
        deletedAt: null,
      });
      tournamentRepository.listParticipants.mockResolvedValue({
        items: [
          { userId: 'u-1', username: 'u_1', registeredAt: '2025-12-30T00:00:00.000Z' },
          { userId: 'u-2', username: 'u_2', registeredAt: '2025-12-30T00:00:00.000Z' },
        ],
        total: 2,
      });

      await service.dispatchStartingSoonNotifications({
        windowStartIso,
        windowEndIso,
      });

      expect(tournamentOutbox.scheduleTournamentEvent).not.toHaveBeenCalled();
      expect(tournamentOutbox.scheduleTournamentEventsBatch).toHaveBeenCalledTimes(1);
    });

    it('skips the batch when advanceTournamentToRegistration returns false', async () => {
      tournamentRepository.listTournamentsStartingSoon.mockResolvedValue([
        {
          tournamentId: 't-3',
          title: 'Already advanced',
          description: null,
          difficulty: 'easy',
          status: 'registration',
          prize: null,
          startAt: '2026-01-01T01:00:00.000Z',
          endAt: '2026-01-01T02:00:00.000Z',
          maxParticipants: 5,
          categoryId: null,
          ownerUserId: 'owner-1',
          createdAt: '2025-12-31T00:00:00.000Z',
          updatedAt: '2025-12-31T00:00:00.000Z',
          deletedAt: null,
        },
      ]);
      tournamentRepository.countParticipants.mockResolvedValue(2);
      tournamentRepository.markTournamentStatus.mockResolvedValue(null);

      const result = await service.dispatchStartingSoonNotifications({
        windowStartIso,
        windowEndIso,
      });

      expect(result).toBe(0);
      expect(tournamentOutbox.scheduleTournamentEventsBatch).not.toHaveBeenCalled();
    });
  });
});
