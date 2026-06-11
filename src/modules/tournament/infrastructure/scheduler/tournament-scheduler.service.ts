import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TournamentLifecycleService } from '../../domain/tournament-lifecycle.service';

@Injectable()
export class TournamentSchedulerService {
  constructor(
    private readonly lifecycleService: TournamentLifecycleService,
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
}
