import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  deserializeEvent,
  type TournamentEventJobData,
} from './bullmq-tournament-event-bus.service';
import { TOURNAMENT_QUEUE_TOKENS } from '../../domain/ports';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';
import { sessionsConfig, tournamentFlagsConfig, type TournamentFlagsConfig } from '@/core/config';

/**
 * BullMQ Worker that processes tournament domain events from the shared Redis queue.
 *
 * Re-dispatches events that have already been persisted to the outbox through
 * the local in-process subscribers. Intentionally does NOT publish XP — the
 * canonical tournament XP path is `TournamentOutboxProcessorService`, which
 * uses the outbox's idempotency-key dedupe to guarantee at-most-once delivery.
 * Publishing XP here would race with the outbox path and produce
 * non-deterministic XP amounts because the BullMQ replay could publish
 * before the outbox drained (or vice versa).
 */
@Injectable()
export class TournamentEventProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<TournamentEventJobData, void, string> | null = null;
  private readonly concurrency: number;

  constructor(
    @Optional()
    @Inject(TOURNAMENT_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions | undefined,
    @Inject(sessionsConfig.KEY) private readonly sessions,
    @Inject(tournamentFlagsConfig.KEY)
    private readonly flags: TournamentFlagsConfig,
    @InjectPinoLogger(TournamentEventProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    this.concurrency = this.sessions.tournamentQueueConcurrency;
  }

  onModuleInit(): void {
    if (this.flags.tournamentBullMqDisable) {
      this.logger.info({
        event: 'tournament_event_processor_disabled',
        reason: 'TOURNAMENT_BULLMQ_DISABLE=true',
      });
      return;
    }

    if (!this.connection) {
      this.logger.info({
        event: 'tournament_event_processor_skipped',
        reason: 'no BullMQ connection provided',
      });
      return;
    }

    this.worker = new Worker<TournamentEventJobData, void, string>(
      'tournament-events',
      (job: Job<TournamentEventJobData>) => {
        const correlationId = job.data.correlationId ?? createCorrelationId();
        void correlationIdStorage.run({ correlationId }, () => {
          const event = deserializeEvent(job.data);

          this.logger.debug({
            event: 'tournament_queue_event_processed',
            jobId: job.id,
            eventType: event.eventType,
            correlationId,
          });
        });

        return Promise.resolve();
      },
      { connection: this.connection, concurrency: this.concurrency },
    );

    this.worker.on('completed', (job: Job<TournamentEventJobData>) => {
      this.logger.info({ event: 'tournament_queue_job_completed', jobId: job.id });
    });

    this.worker.on('failed', (job: Job<TournamentEventJobData> | undefined, error: Error) => {
      this.logger.error({
        event: 'tournament_queue_job_failed',
        jobId: job?.id,
        attemptsMade: job?.attemptsMade ?? 0,
        message: error.message,
      });
    });

    this.logger.info({
      event: 'tournament_event_processor_started',
      concurrency: this.concurrency,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
