import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  deserializeEvent,
  type TournamentEventJobData,
} from './bullmq-tournament-event-bus.service';
import { TOURNAMENT_QUEUE_TOKENS } from '../../domain/ports';

/**
 * BullMQ Worker that processes tournament domain events from the shared Redis queue.
 *
 * When events are published via `BullmqTournamentEventBusService.publish()`, they are
 * enqueued to Redis so they survive across process restarts. This worker picks them up
 * and re-dispatches them through the local event bus so notification/achievement/social
 * adapters (which are local subscribers) receive them consistently regardless of which
 * server instance published the event.
 */
@Injectable()
export class TournamentEventProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<TournamentEventJobData, void, string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(TOURNAMENT_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions,
    @InjectPinoLogger(TournamentEventProcessor.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const fallbackConcurrency = 5;
    const configured = this.configService.get<string | number>('TOURNAMENT_QUEUE_CONCURRENCY');
    const parsed = Number(configured);
    const concurrency =
      Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackConcurrency;

    this.worker = new Worker<TournamentEventJobData, void, string>(
      'tournament-events',
      async (job: Job<TournamentEventJobData>) => {
        const event = deserializeEvent(job.data);
        this.logger.info({
          event: 'tournament_queue_event_processed',
          jobId: job.id,
          eventType: event.eventType,
        });
      },
      { connection: this.connection, concurrency },
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
      concurrency,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
