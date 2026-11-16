import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InstanceService } from '../../domain/instance.service';
import { QUIZ_INSTANCE_REPOSITORY_PORT, type QuizInstanceRepositoryPort } from '../../domain/ports';

@Injectable()
export class InstanceAbandonmentSchedulerService {
  static readonly BATCH_SIZE = 50;
  static readonly PARALLELISM = 10;
  static readonly ABANDONMENT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  static get CRON_EXPRESSION(): string {
    return (
      process.env['INSTANCE_ABANDONMENT_CRON_OVERRIDE']?.trim() || CronExpression.EVERY_30_SECONDS
    );
  }

  constructor(
    private readonly instanceService: InstanceService,
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @InjectPinoLogger(InstanceAbandonmentSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron(InstanceAbandonmentSchedulerService.CRON_EXPRESSION)
  async handleAbandonedInstances(): Promise<void> {
    const cutoffIso = new Date(
      Date.now() - InstanceAbandonmentSchedulerService.ABANDONMENT_TTL_MS,
    ).toISOString();

    let abandoned: ReadonlyArray<{
      instanceId: string;
      version: number;
    }>;
    try {
      abandoned = await this.instanceRepository.findAbandonedInstances({
        cutoffIso,
        limit: InstanceAbandonmentSchedulerService.BATCH_SIZE,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_abandonment_scheduler_query_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (abandoned.length === 0) {
      return;
    }

    this.logger.info({
      event: 'instance_abandonment_scheduler_found',
      count: abandoned.length,
    });

    for (let i = 0; i < abandoned.length; i += InstanceAbandonmentSchedulerService.PARALLELISM) {
      const chunk = abandoned.slice(i, i + InstanceAbandonmentSchedulerService.PARALLELISM);
      await Promise.allSettled(chunk.map((row) => this.runAbandonment(row)));
    }
  }

  private async runAbandonment(row: { instanceId: string; version: number }): Promise<void> {
    try {
      const result = await this.instanceService.abandonInstanceByScheduler({
        instanceId: row.instanceId,
        expectedVersion: row.version,
      });
      if (result.abandoned) {
        this.logger.info({
          event: 'instance_abandoned_auto_closed',
          instanceId: row.instanceId,
          closedAt: result.closedAt,
        });
      } else {
        this.logger.debug({
          event: 'instance_abandonment_scheduler_skipped',
          instanceId: row.instanceId,
          reason: result.reason,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'instance_abandonment_scheduler_failed',
        instanceId: row.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
