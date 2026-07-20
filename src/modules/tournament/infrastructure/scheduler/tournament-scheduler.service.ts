import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TournamentLifecycleService } from '../../domain/tournament-lifecycle.service';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
} from '../../domain/ports/tournament-repository.port';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

/**
 * Phase 2 / Issues #8, #38 — advisory lock TTL constants.
 *
 * These values are conservative upper bounds on how long each job
 * can reasonably take. The lock auto-releases at TTL expiry, so
 * a crashed replica can never hold a lock indefinitely. Set TTL
 * to 2–3× the expected maximum job duration.
 */
const LOCK_TTL_MS = Object.freeze({
  /** 5-minute TTL — `handleRegistrationOpen` and `handleTournamentStart` run every 5 min */
  REGISTRATION_OPEN: 5 * 60 * 1000,
  TOURNAMENT_START: 5 * 60 * 1000,
  /** 15-minute TTL — `handleTournamentFinalize` runs every 15 min */
  TOURNAMENT_FINALIZE: 15 * 60 * 1000,
  /** 60-minute TTL — `handleParticipantTotalsReconcile` runs daily at 4:30 AM */
  TOTALS_RECONCILE: 60 * 60 * 1000,
});

@Injectable()
export class TournamentSchedulerService {
  constructor(
    private readonly lifecycleService: TournamentLifecycleService,
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(TournamentSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Opens registration for tournaments that have reached their start window.
   * Runs every 5 minutes to catch tournaments transitioning from upcoming → registration.
   *
   * Phase 2 / Issue #8, #38: Protected by a Redis advisory lock so that only
   * one replica processes this job at a time. Other replicas skip immediately.
   */
  @Cron('*/5 * * * *')
  async handleRegistrationOpen(): Promise<void> {
    const lockKey = 'tournament:cron:registration-open';
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.REGISTRATION_OPEN);
    if (!acquired) {
      this.logger.info({
        event: 'tournament_scheduler_skipped_lock_held',
        job: 'handleRegistrationOpen',
      });
      return;
    }

    try {
      await this.runRegistrationOpen();
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  private async runRegistrationOpen(): Promise<void> {
    const now = new Date().toISOString();
    this.logger.info({ event: 'tournament_scheduler_registration_open_start' });

    try {
      const result = await this.lifecycleService.dispatchStartingSoonNotifications({
        windowStartIso: now,
        windowEndIso: now,
      });

      this.logger.info({
        event: 'tournament_scheduler_registration_open_complete',
        notificationsPublished: result,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_scheduler_registration_open_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Activates tournaments that have passed their startAt time.
   * Runs every 5 minutes to transition registration → ongoing.
   *
   * Phase 2 / Issue #8, #38: Protected by a Redis advisory lock.
   */
  @Cron('*/5 * * * *')
  async handleTournamentStart(): Promise<void> {
    const lockKey = 'tournament:cron:tournament-start';
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.TOURNAMENT_START);
    if (!acquired) {
      this.logger.info({
        event: 'tournament_scheduler_skipped_lock_held',
        job: 'handleTournamentStart',
      });
      return;
    }

    try {
      await this.runTournamentStart();
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  private async runTournamentStart(): Promise<void> {
    const now = new Date().toISOString();
    this.logger.info({ event: 'tournament_scheduler_start_due_start' });

    try {
      const result = await this.lifecycleService.startDueTournaments(now);

      this.logger.info({
        event: 'tournament_scheduler_start_due_complete',
        tournamentsStarted: result,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_scheduler_start_due_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Finalizes tournaments that have passed their endAt time.
   * Runs every 15 minutes to transition ongoing → finished and assign final ranks.
   *
   * Phase 2 / Issue #8, #38: Protected by a Redis advisory lock.
   */
  @Cron('*/15 * * * *')
  async handleTournamentFinalize(): Promise<void> {
    const lockKey = 'tournament:cron:tournament-finalize';
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.TOURNAMENT_FINALIZE);
    if (!acquired) {
      this.logger.info({
        event: 'tournament_scheduler_skipped_lock_held',
        job: 'handleTournamentFinalize',
      });
      return;
    }

    try {
      await this.runTournamentFinalize();
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  private async runTournamentFinalize(): Promise<void> {
    const now = new Date().toISOString();
    this.logger.info({ event: 'tournament_scheduler_finalize_start' });

    try {
      const result = await this.lifecycleService.finalizeDueTournaments(now);

      this.logger.info({
        event: 'tournament_scheduler_finalize_complete',
        tournamentsFinalized: result,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_scheduler_finalize_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Daily reconciliation of denormalized tournament participant totals.
   *
   * Scheduled at 4:30 AM — after the analytics scheduler's 3 AM full
   * rebuild and 2 AM daily validation, but before the next day's traffic,
   * so it can never race with the analytics path on the same cache rows.
   *
   * Phase 2 / Issue #8, #38: Protected by a Redis advisory lock.
   */
  @Cron('30 4 * * *')
  async handleParticipantTotalsReconcile(): Promise<void> {
    const lockKey = 'tournament:cron:totals-reconcile';
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.TOTALS_RECONCILE);
    if (!acquired) {
      this.logger.info({
        event: 'tournament_scheduler_skipped_lock_held',
        job: 'handleParticipantTotalsReconcile',
      });
      return;
    }

    try {
      await this.runParticipantTotalsReconcile();
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  private async runParticipantTotalsReconcile(): Promise<void> {
    this.logger.info({ event: 'tournament_scheduler_totals_reconcile_start' });

    try {
      const result = await this.tournamentRepository.reconcileAllParticipantTotals();

      this.logger.info({
        event: 'tournament_scheduler_totals_reconcile_complete',
        participantsUpdated: result.updated,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_scheduler_totals_reconcile_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
