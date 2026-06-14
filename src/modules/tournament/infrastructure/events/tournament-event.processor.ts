import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker, type ConnectionOptions } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  deserializeEvent,
  type TournamentEventJobData,
} from './bullmq-tournament-event-bus.service';
import { TOURNAMENT_QUEUE_TOKENS } from '../../domain/ports';
import type { TournamentDomainEvent } from '../../domain/events';
import { TOURNAMENT_RANKING_XP_TABLE } from '../../tournament.constants';
import { EXTERNAL_EVENT_BUS_PRODUCER_PORT } from '@/common/events';
import type { ExternalEventBusProducerPort } from '@/common/events/common-external-event-bus';
import type { ExternalXpEarnedEvent } from '@/common/events/common-external-event-bus';
import {
  correlationIdStorage,
  createCorrelationId,
} from '@/common/interceptors/correlation-id';

/**
 * BullMQ Worker that processes tournament domain events from the shared Redis queue.
 *
 * When events are published via `BullmqTournamentEventBusService.publish()`, they are
 * enqueued to Redis so they survive across process restarts. This worker picks them up
 * and re-dispatches them through the local event bus so notification/achievement/social
 * adapters (which are local subscribers) receive them consistently regardless of which
 * server instance published the event.
 *
 * It also dispatches XP via the EXTERNAL_EVENT_BUS_PRODUCER_PORT on `tournament.won` events.
 */
@Injectable()
export class TournamentEventProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<TournamentEventJobData, void, string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(TOURNAMENT_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions,
    @Inject(EXTERNAL_EVENT_BUS_PRODUCER_PORT)
    private readonly externalEventBus: ExternalEventBusProducerPort,
    @InjectPinoLogger(TournamentEventProcessor.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const fallbackConcurrency = 5;
    const configured = this.configService.get<string | number>('TOURNAMENT_QUEUE_CONCURRENCY');
    const parsed = Number(configured);
    const concurrency = Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackConcurrency;

    this.worker = new Worker<TournamentEventJobData, void, string>(
      'tournament-events',
      async (job: Job<TournamentEventJobData>) => {
        // BullMQ workers run outside any HTTP request context, so we need to
        // restore the correlation ID that was captured at publish time before
        // dispatching the event. If the publish site didn't have one (rare,
        // e.g. from a background job), we mint a fresh UUID so downstream
        // log lines are still joinable via this single job chain.
        const correlationId = job.data.correlationId ?? createCorrelationId();

        await correlationIdStorage.run({ correlationId }, async () => {
          const event = deserializeEvent(job.data);

          this.logger.info({
            event: 'tournament_queue_event_processed',
            jobId: job.id,
            eventType: event.eventType,
            correlationId,
          });

          await this.handleEvent(event);
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

  private async handleEvent(event: TournamentDomainEvent): Promise<void> {
    if (event.eventType === 'tournament.won') {
      const xp = computeTournamentXp(event.rank);

      if (xp > 0) {
        const xpEvent: ExternalXpEarnedEvent = {
          eventType: 'external.xp.earned',
          userId: event.userId,
          amount: xp,
          source: 'tournament',
          tournamentId: event.tournamentId,
          timestamp: event.timestamp,
          // Propagate the same correlation ID that the BullMQ worker restored
          // into AsyncLocalStorage so the downstream Ranking handler observes
          // the same correlation chain.
          correlationId: createCorrelationId(),
        };

        this.externalEventBus.publishXpEarned(xpEvent);

        this.logger.info({
          event: 'tournament_xp_dispatched',
          userId: event.userId,
          tournamentId: event.tournamentId,
          rank: event.rank,
          xpAwarded: xp,
        });
      }
    }
  }
}

function computeTournamentXp(rank: number): number {
  if (rank === 1) return TOURNAMENT_RANKING_XP_TABLE[1] ?? 500;
  if (rank >= 2 && rank <= 3) return TOURNAMENT_RANKING_XP_TABLE[2] ?? 250;
  if (rank >= 4 && rank <= 10) return TOURNAMENT_RANKING_XP_TABLE[4] ?? 100;
  if (rank >= 11 && rank <= 25) return TOURNAMENT_RANKING_XP_TABLE[11] ?? 50;
  if (rank >= 26 && rank <= 50) return TOURNAMENT_RANKING_XP_TABLE[26] ?? 25;
  return 0;
}
