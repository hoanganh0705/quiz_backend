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
 * BullMQ Worker that re-dispatches tournament domain events from the shared
 * Redis queue into the in-process subscriber list registered against
 * `BullmqTournamentEventBusService.subscribe`.
 *
 * Role: log-and-relay only. The worker is intentionally a thin proxy that
 * hands each event to the same in-process handlers already registered for
 * the synchronous path. It owns **no domain state** and **must not**
 * introduce its own side effects — any such side effect would race with the
 * `TournamentOutboxProcessorService` XP path and produce non-deterministic
 * XP amounts because BullMQ replay and the outbox drain can interleave in
 * either order.
 *
 * Prohibited inside this worker:
 *   1. Writing to the `outbox_events` table. The outbox is the single
 *      source of truth for tournament XP; the worker must not compete.
 *   2. Calling `XpIngestionService.ingest` (or any wrapper of it) directly.
 *      XP must reach ranking only via the outbox + idempotency-key dedupe.
 *   3. Calling `UserProfileService.applyMutation` or any other side-effecting
 *      domain service. The worker may only log the event and call registered
 *      notification handlers, never mutate the read model.
 *
 * Failure modes: `failed` jobs are surfaced through the BullMQ failure event
 * and do not bypass the outbox. Retries are governed by the shared
 * `DEFAULT_RETRY_POLICY` so behaviour matches every other BullMQ producer.
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
