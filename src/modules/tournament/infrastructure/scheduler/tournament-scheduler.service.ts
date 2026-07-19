import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TournamentLifecycleService } from '../../domain/tournament-lifecycle.service';
import {
  TOURNAMENT_REPOSITORY_PORT,
  type TournamentRepositoryPort,
} from '../../domain/ports/tournament-repository.port';

@Injectable()
export class TournamentSchedulerService {
  constructor(
    private readonly lifecycleService: TournamentLifecycleService,
    @Inject(TOURNAMENT_REPOSITORY_PORT)
    private readonly tournamentRepository: TournamentRepositoryPort,
    @InjectPinoLogger(TournamentSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Opens registration for tournaments that have reached their start window.
   * Runs every 5 minutes to catch tournaments transitioning from upcoming → registration.
   */
  @Cron('*/5 * * * *')
  async handleRegistrationOpen(): Promise<void> {
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
   */
  @Cron('*/5 * * * *')
  async handleTournamentStart(): Promise<void> {
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
   */
  @Cron('*/15 * * * *')
  async handleTournamentFinalize(): Promise<void> {
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
   * Re-runs the equivalent of migration
   * `0008_reconcile_tournament_participant_totals.sql` against every
   * participant so any drift accumulated since the last run (e.g.
   * pre-Fix-#1 history, or future code paths that forgot to call
   * `recalculateParticipantTotals`) is corrected.
   *
   * Scheduled at 4:30 AM — after the analytics scheduler's 3 AM full
   * rebuild and 2 AM daily validation, but before the next day's traffic,
   * so it can never race with the analytics path on the same cache rows.
   *
   * See `docs/plans/denormalized-counters-audit.md` — Fix #1, last bullet.
   */
  @Cron('30 4 * * *')
  async handleParticipantTotalsReconcile(): Promise<void> {
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
