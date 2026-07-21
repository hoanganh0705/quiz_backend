/// <reference types="jest" />
/**
 * Round lifecycle / Issue #round-lifecycle — scheduler unit tests.
 *
 * Covers the three call paths for both new cron methods:
 *
 *   1. Lock-held path — `acquireAdvisoryLock` returns `false`;
 *      scheduler logs the skip and does NOT delegate.
 *   2. Lock-acquired path — `acquireAdvisoryLock` returns `true`;
 *      scheduler delegates to the lifecycle service.
 *   3. Exception path — the lifecycle service throws; scheduler
 *      logs the failure and STILL releases the lock.
 *
 * The lock-token argument to `releaseAdvisoryLock` is matched as a
 * UUID string (the production code uses `crypto.randomUUID()`);
 * we constrain by shape rather than value because each call
 * generates a fresh UUID.
 */
import { TournamentSchedulerService } from './tournament-scheduler.service';

describe('TournamentSchedulerService — round-lifecycle cron handlers', () => {
  const createSut = () => {
    const lifecycleService = {
      openDueRounds: jest.fn().mockResolvedValue(0),
      closeDueRounds: jest.fn().mockResolvedValue(0),
    };

    const tournamentRepository = {
      reconcileAllParticipantTotals: jest.fn(),
    };

    const cache = {
      acquireAdvisoryLock: jest.fn().mockResolvedValue(true),
      releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
    };

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const sut = new TournamentSchedulerService(
      lifecycleService as never,
      tournamentRepository as never,
      cache as never,
      logger as never,
    );

    return { sut, lifecycleService, cache, logger };
  };

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  describe('handleOpenDueRounds', () => {
    it('skips and logs when the advisory lock is held by another replica', async () => {
      const { sut, lifecycleService, cache, logger } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValueOnce(false);

      await sut.handleOpenDueRounds();

      expect(cache.acquireAdvisoryLock).toHaveBeenCalledWith(
        'tournament:cron:round-open',
        expect.any(Number),
      );
      expect(lifecycleService.openDueRounds).not.toHaveBeenCalled();
      expect(cache.releaseAdvisoryLock).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_skipped_lock_held',
          job: 'handleOpenDueRounds',
        }),
      );
    });

    it('delegates to lifecycleService.openDueRounds and releases the lock with a UUID token', async () => {
      const { sut, lifecycleService, cache, logger } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValueOnce(true);
      lifecycleService.openDueRounds.mockResolvedValueOnce(7);

      await sut.handleOpenDueRounds();

      expect(cache.acquireAdvisoryLock).toHaveBeenCalledWith(
        'tournament:cron:round-open',
        expect.any(Number),
      );
      expect(lifecycleService.openDueRounds).toHaveBeenCalledTimes(1);
      // The `nowIso` argument is `new Date().toISOString()` — any valid
      // ISO string is acceptable.
      expect(lifecycleService.openDueRounds).toHaveBeenCalledWith(expect.any(String));
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_round_open_start',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_round_open_complete',
          roundsOpened: 7,
        }),
      );

      // Lock release happens in the `finally` block — verify it ran
      // and carried a UUID-shaped token.
      expect(cache.releaseAdvisoryLock).toHaveBeenCalledTimes(1);
      const [releasedKey, releasedToken] = cache.releaseAdvisoryLock.mock.calls[0]!;
      expect(releasedKey).toBe('tournament:cron:round-open');
      expect(typeof releasedToken).toBe('string');
      expect(releasedToken).toMatch(UUID_REGEX);
    });

    it('releases the lock and logs a failure when the lifecycle service throws', async () => {
      const { sut, lifecycleService, cache, logger } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValueOnce(true);
      lifecycleService.openDueRounds.mockRejectedValueOnce(new Error('DB unreachable'));

      await sut.handleOpenDueRounds();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_round_open_failed',
          error: 'DB unreachable',
        }),
      );
      // Critical: lock must still be released even when the inner
      // call threw — otherwise a misbehaving job holds the lock for
      // the entire TTL.
      expect(cache.releaseAdvisoryLock).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCloseDueRounds', () => {
    it('skips and logs when the advisory lock is held by another replica', async () => {
      const { sut, lifecycleService, cache, logger } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValueOnce(false);

      await sut.handleCloseDueRounds();

      expect(cache.acquireAdvisoryLock).toHaveBeenCalledWith(
        'tournament:cron:round-close',
        expect.any(Number),
      );
      expect(lifecycleService.closeDueRounds).not.toHaveBeenCalled();
      expect(cache.releaseAdvisoryLock).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_skipped_lock_held',
          job: 'handleCloseDueRounds',
        }),
      );
    });

    it('delegates to lifecycleService.closeDueRounds with the round-close key and a UUID token', async () => {
      const { sut, lifecycleService, cache, logger } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValueOnce(true);
      lifecycleService.closeDueRounds.mockResolvedValueOnce(3);

      await sut.handleCloseDueRounds();

      expect(cache.acquireAdvisoryLock).toHaveBeenCalledWith(
        'tournament:cron:round-close',
        expect.any(Number),
      );
      expect(lifecycleService.closeDueRounds).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_round_close_complete',
          roundsClosed: 3,
        }),
      );

      expect(cache.releaseAdvisoryLock).toHaveBeenCalledTimes(1);
      const [releasedKey, releasedToken] = cache.releaseAdvisoryLock.mock.calls[0]!;
      expect(releasedKey).toBe('tournament:cron:round-close');
      expect(releasedToken).toMatch(UUID_REGEX);
    });

    it('releases the lock and logs a failure when the lifecycle service throws', async () => {
      const { sut, lifecycleService, cache, logger } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValueOnce(true);
      lifecycleService.closeDueRounds.mockRejectedValueOnce(new Error('Constraint violation'));

      await sut.handleCloseDueRounds();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tournament_scheduler_round_close_failed',
          error: 'Constraint violation',
        }),
      );
      expect(cache.releaseAdvisoryLock).toHaveBeenCalledTimes(1);
    });
  });

  describe('lock TTL constants', () => {
    /**
     * Sanity check that the constant is in the documented range
     * (5 minutes ± 10% per `docs/round-lifecycle.md` Phase 4a).
     * Locks shorter than the 60s cron cadence would risk overlapping
     * runs across a slow tick; locks longer than ~10 minutes would
     * outlast the lock-holder's reasonable recovery window.
     */
    it('uses a 5-minute TTL for the round-open and round-close locks', async () => {
      const { sut, cache } = createSut();
      cache.acquireAdvisoryLock.mockResolvedValue(false);

      await sut.handleOpenDueRounds();
      await sut.handleCloseDueRounds();

      const openTtl = cache.acquireAdvisoryLock.mock.calls[0]?.[1];
      const closeTtl = cache.acquireAdvisoryLock.mock.calls[1]?.[1];
      expect(openTtl).toBe(5 * 60 * 1000);
      expect(closeTtl).toBe(5 * 60 * 1000);
    });
  });
});
