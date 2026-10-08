import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InstanceService } from '../../domain/instance.service';
import { QUIZ_INSTANCE_REPOSITORY_PORT, type QuizInstanceRepositoryPort } from '../../domain/ports';

@Injectable()
export class InstanceCountdownSchedulerService {
  static readonly TICK_BATCH_SIZE = 50;

  static get CRON_EXPRESSION(): string {
    return (
      process.env['INSTANCE_COUNTDOWN_CRON_OVERRIDE']?.trim() || CronExpression.EVERY_5_SECONDS
    );
  }

  constructor(
    private readonly instanceService: InstanceService,
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @InjectPinoLogger(InstanceCountdownSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  private static readonly PARALLELISM = 10;

  @Cron(InstanceCountdownSchedulerService.CRON_EXPRESSION)
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

    for (let i = 0; i < due.length; i += InstanceCountdownSchedulerService.PARALLELISM) {
      const chunk = due.slice(i, i + InstanceCountdownSchedulerService.PARALLELISM);
      await Promise.allSettled(chunk.map((row) => this.runCountdown(row)));
    }
  }

  private async runCountdown(row: {
    instanceId: string;
    version: number;
    countdownStartedAt: string;
  }): Promise<void> {
    try {
      const result = await this.instanceService.completeCountdownByScheduler({
        instanceId: row.instanceId,
        expectedVersion: row.version,
      });
      if (!result.completed) {
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
