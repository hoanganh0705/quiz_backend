import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TournamentLifecycleService } from '../../domain/tournament-lifecycle.service';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
} from '../../domain/ports/tournament-repository.port';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const LOCK_TTL_MS = Object.freeze({
  /** 5-minute TTL — `handleRegistrationOpen` and `handleTournamentStart` run every 5 min */
  REGISTRATION_OPEN: 5 * 60 * 1000,
  TOURNAMENT_START: 5 * 60 * 1000,
  /** 15-minute TTL — `handleTournamentFinalize` runs every 15 min */
  TOURNAMENT_FINALIZE: 15 * 60 * 1000,
  /** 10-minute TTL — round lifecycle jobs run every minute; 10x headroom for batched drain */
  ROUND_OPEN: 10 * 60 * 1000,
  ROUND_CLOSE: 10 * 60 * 1000,
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

  @Cron('*/5 * * * *')
  async handleRegistrationOpen(): Promise<void> {
    const lockKey = 'tournament:cron:registration-open';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.REGISTRATION_OPEN);
    if (lockToken === null) {
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
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    this.logger.info({ event: 'tournament_scheduler_registration_open_start' });

    try {
      const result = await this.lifecycleService.dispatchStartingSoonNotifications({
        windowStartIso: fiveMinutesAgo.toISOString(),
        windowEndIso: fiveMinutesFromNow.toISOString(),
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

  @Cron('*/5 * * * *')
  async handleTournamentStart(): Promise<void> {
    const lockKey = 'tournament:cron:tournament-start';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.TOURNAMENT_START);
    if (lockToken === null) {
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

  @Cron('*/15 * * * *')
  async handleTournamentFinalize(): Promise<void> {
    const lockKey = 'tournament:cron:tournament-finalize';
    const lockToken = await this.cache.acquireAdvisoryLock(
      lockKey,
      LOCK_TTL_MS.TOURNAMENT_FINALIZE,
    );
    if (lockToken === null) {
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
  @Cron('30 4 * * *')
  async handleParticipantTotalsReconcile(): Promise<void> {
    const lockKey = 'tournament:cron:totals-reconcile';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.TOTALS_RECONCILE);
    if (lockToken === null) {
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

  /**
   * Round lifecycle / Issue #round-lifecycle — opens rounds whose
   * `start_at` has elapsed AND whose parent tournament is `ongoing`.
   * Runs every minute for ≤60s user-perceived latency from
   * `round.startAt` to "Round is now open."
   *
   * Protected by a Redis advisory lock so that only one replica
   * processes this job at a time; other replicas skip immediately.
   * Per-tick batch size is bounded inside the lifecycle service
   * (`PAGE_SIZE = 100`), so the lock TTL has 5x headroom against the
   * worst-case drain.
   */
  @Cron('* * * * *')
  async handleOpenDueRounds(): Promise<void> {
    const lockKey = 'tournament:cron:round-open';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.ROUND_OPEN);
    if (lockToken === null) {
      this.logger.info({
        event: 'tournament_scheduler_skipped_lock_held',
        job: 'handleOpenDueRounds',
      });
      return;
    }

    try {
      await this.runOpenDueRounds();
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  private async runOpenDueRounds(): Promise<void> {
    const now = new Date().toISOString();
    this.logger.info({ event: 'tournament_scheduler_round_open_start' });

    try {
      const result = await this.lifecycleService.openDueRounds(now);

      this.logger.info({
        event: 'tournament_scheduler_round_open_complete',
        roundsOpened: result,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_scheduler_round_open_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Round lifecycle / Issue #round-lifecycle — closes rounds whose
   * `end_at` has elapsed. Symmetric to `handleOpenDueRounds`: every
   * minute, Redis advisory lock, paginated drain inside the lifecycle
   * service.
   */
  @Cron('* * * * *')
  async handleCloseDueRounds(): Promise<void> {
    const lockKey = 'tournament:cron:round-close';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.ROUND_CLOSE);
    if (lockToken === null) {
      this.logger.info({
        event: 'tournament_scheduler_skipped_lock_held',
        job: 'handleCloseDueRounds',
      });
      return;
    }

    try {
      await this.runCloseDueRounds();
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  private async runCloseDueRounds(): Promise<void> {
    const now = new Date().toISOString();
    this.logger.info({ event: 'tournament_scheduler_round_close_start' });

    try {
      const result = await this.lifecycleService.closeDueRounds(now);

      this.logger.info({
        event: 'tournament_scheduler_round_close_complete',
        roundsClosed: result,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_scheduler_round_close_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
