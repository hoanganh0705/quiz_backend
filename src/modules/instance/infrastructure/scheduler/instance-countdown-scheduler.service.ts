import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InstanceService } from '../../domain/instance.service';
import { QUIZ_INSTANCE_REPOSITORY_PORT, type QuizInstanceRepositoryPort } from '../../domain/ports';

@Injectable()
export class InstanceCountdownSchedulerService {
  static readonly TICK_BATCH_SIZE = 50;

  constructor(
    private readonly instanceService: InstanceService,
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @InjectPinoLogger(InstanceCountdownSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async handleDueCountdowns(): Promise<void> {
    const cutoffIso = new Date(Date.now() - InstanceService.COUNTDOWN_DURATION_MS).toISOString();

    let due: ReadonlyArray<{
      instanceId: string;
      version: number;
      countdownStartedAt: string;
    }>;
    try {
      due = await this.instanceRepository.findDueCountdowns({
        nowIso: cutoffIso,
        limit: InstanceCountdownSchedulerService.TICK_BATCH_SIZE,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_countdown_scheduler_query_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (due.length === 0) {
      return;
    }

    this.logger.debug({
      event: 'instance_countdown_scheduler_due_rows',
      count: due.length,
    });

    for (const row of due) {
      try {
        const result = await this.instanceService.completeCountdownByScheduler({
          instanceId: row.instanceId,
          expectedVersion: row.version,
        });
        if (!result.completed) {
          // `lost_lock` (host raced us) and `state_changed` (host
          // cancelled) are both expected; only `min_players_not_met`
          // is novel at this layer. The application service has
          // already logged the cancellation event in that case.
          this.logger.debug({
            event: 'instance_countdown_scheduler_skipped',
            instanceId: row.instanceId,
            reason: result.reason,
          });
        }
      } catch (error) {
        this.logger.error({
          event: 'instance_countdown_scheduler_complete_failed',
          instanceId: row.instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
