import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';
import { sessionsConfig } from '@/core/config';

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
  private readonly concurrency: number;

  constructor(
    @Inject(TOURNAMENT_QUEUE_TOKENS.CONNECTION)
    private readonly connection: ConnectionOptions,
    @Inject(EXTERNAL_EVENT_BUS_PRODUCER_PORT)
    private readonly externalEventBus: ExternalEventBusProducerPort,
    @InjectPinoLogger(TournamentEventProcessor.name)
    private readonly logger: PinoLogger,
    @Inject(sessionsConfig.KEY) private readonly sessions,
  ) {
    this.concurrency = this.sessions.tournamentQueueConcurrency;
  }

  onModuleInit(): void {
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

          await this.handleEvent(event, correlationId);
        });
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

  private async handleEvent(event: TournamentDomainEvent, correlationId: string): Promise<void> {
    if (event.eventType === 'tournament.won') {
      const xp = computeTournamentXp(event.rank);

      if (xp > 0) {
        // Phase 2 / Issue #9 — idempotency key + correlation ID propagation.
        //
        // Idempotency key: The same tournament win event must never produce
        // duplicate XP grants. A retry of the BullMQ job (e.g. worker crash
        // before acknowledgment) would re-deliver the event and re-grant XP
        // without this key. The `XpIngestionService` uses this key verbatim
        // (the `deriveIdempotencyKey` function checks `event.idempotencyKey`
        // first) so the duplicate is safely dropped.
        //
        // The key encodes `${tournamentId}:${userId}:${rank}` — unique per
        // tournament finish, per user, per rank. A user finishing 2nd in
        // tournament T gets the key `T:userX:2`, and a retry delivering the
        // same `TournamentWonEvent` will produce the same `ExternalXpEarnedEvent`
        // with the same `idempotencyKey`, which the XP ledger dedupes.
        //
        // Correlation ID: Instead of minting a fresh UUID (which breaks the
        // log trace chain), we pass the correlation ID that was captured
        // from the BullMQ job data into `correlationIdStorage` by the worker
        // and now passed as a parameter. This propagates the original
        // correlation ID from the publish site through the entire XP grant chain.
        const idempotencyKey = `${event.tournamentId}:${event.userId}:${event.rank}`;

        const xpEvent: ExternalXpEarnedEvent = {
          eventType: 'external.xp.earned',
          userId: event.userId,
          amount: xp,
          source: 'tournament',
          tournamentId: event.tournamentId,
          rank: event.rank,
          timestamp: event.timestamp,
          idempotencyKey,
          correlationId,
        };

        this.externalEventBus.publishXpEarned(xpEvent);

        this.logger.info({
          event: 'tournament_xp_dispatched',
          userId: event.userId,
          tournamentId: event.tournamentId,
          rank: event.rank,
          xpAwarded: xp,
          idempotencyKey,
          correlationId,
        });
      }
    }
    return Promise.resolve();
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
