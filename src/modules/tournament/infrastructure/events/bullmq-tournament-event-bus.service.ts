import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { TournamentDomainEventBusPort } from '../../domain/ports';
import { TOURNAMENT_QUEUE_TOKENS } from '../../domain/ports';
import type { TournamentDomainEvent } from '../../domain/events';
import { TournamentJoinedEvent, TournamentParticipantWithdrawnEvent } from '../../domain/events';
import {
  TournamentStartingSoonEvent,
  TournamentCompletedEvent,
  TournamentWonEvent,
} from '../../domain/events';
import { getCorrelationId } from '@/common/interceptors/correlation-id';

@Injectable()
export class BullmqTournamentEventBusService
  implements TournamentDomainEventBusPort, OnModuleDestroy
{
  private handlers: Array<(event: TournamentDomainEvent) => void> = [];

  constructor(
    @Inject(TOURNAMENT_QUEUE_TOKENS.QUEUE)
    private readonly eventQueue: Queue<TournamentEventJobData>,
    @InjectPinoLogger(BullmqTournamentEventBusService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.handlers = [];
  }

  subscribe(handler: (event: TournamentDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  async publish(event: TournamentDomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'tournament_event_inproc_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    try {
      const jobData = serializeEvent(event);
      await this.eventQueue.add(event.eventType, jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800, count: 5_000 },
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_event_enqueue_failed',
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Discriminated-union serializer — converts class instances to plain JSON.
// Captures the current correlation ID (if any) from AsyncLocalStorage so the
// downstream BullMQ worker can restore it before invoking any handler.
function serializeEvent(event: TournamentDomainEvent): TournamentEventJobData {
  const correlationId = getCorrelationId();
  switch (event.eventType) {
    case 'tournament.joined':
      return {
        eventType: event.eventType,
        tournamentId: event.tournamentId,
        userId: event.userId,
        tournamentTitle: event.tournamentTitle,
        occurredAt: event.occurredAt.toISOString(),
        correlationId,
      };
    case 'tournament.participant.withdrawn':
      return {
        eventType: event.eventType,
        tournamentId: event.tournamentId,
        userId: event.userId,
        withdrawnAt: event.withdrawnAt.toISOString(),
        correlationId,
      };
    case 'tournament.starting_soon':
      return {
        eventType: event.eventType,
        userId: event.userId,
        tournamentId: event.tournamentId,
        tournamentTitle: event.tournamentTitle,
        startsAt: event.startsAt,
        timestamp: event.timestamp.toISOString(),
        correlationId,
      };
    case 'tournament.completed':
      return {
        eventType: event.eventType,
        userId: event.userId,
        tournamentId: event.tournamentId,
        tournamentTitle: event.tournamentTitle,
        rank: event.rank,
        totalParticipants: event.totalParticipants,
        timestamp: event.timestamp.toISOString(),
        correlationId,
      };
    case 'tournament.won':
      return {
        eventType: event.eventType,
        userId: event.userId,
        tournamentId: event.tournamentId,
        tournamentTitle: event.tournamentTitle,
        rank: event.rank,
        prize: event.prize,
        timestamp: event.timestamp.toISOString(),
        correlationId,
      };
  }
}

// Discriminated-union deserializer — reconstructs class instances from queue payload
export function deserializeEvent(data: TournamentEventJobData): TournamentDomainEvent {
  switch (data.eventType) {
    case 'tournament.joined':
      return new TournamentJoinedEvent(
        data.tournamentId,
        data.userId,
        (data as { tournamentTitle: string }).tournamentTitle,
        new Date(data.occurredAt),
      );
    case 'tournament.participant.withdrawn':
      return new TournamentParticipantWithdrawnEvent(
        data.tournamentId,
        data.userId,
        new Date(data.withdrawnAt),
      );
    case 'tournament.starting_soon':
      return new TournamentStartingSoonEvent(
        data.userId,
        data.tournamentId,
        data.tournamentTitle,
        data.startsAt,
        new Date(data.timestamp),
      );
    case 'tournament.completed':
      return new TournamentCompletedEvent(
        data.userId,
        data.tournamentId,
        data.tournamentTitle,
        data.rank,
        data.totalParticipants,
        new Date(data.timestamp),
      );
    case 'tournament.won':
      return new TournamentWonEvent(
        data.userId,
        data.tournamentId,
        data.tournamentTitle,
        data.rank,
        data.prize,
        new Date(data.timestamp),
      );
  }
}

// Union type covering all event shapes as plain JSON (what BullMQ serializes)
export type TournamentEventJobData =
  | {
      eventType: 'tournament.joined';
      tournamentId: string;
      userId: string;
      tournamentTitle: string;
      occurredAt: string;
      correlationId?: string;
    }
  | {
      eventType: 'tournament.participant.withdrawn';
      tournamentId: string;
      userId: string;
      withdrawnAt: string;
      correlationId?: string;
    }
  | {
      eventType: 'tournament.starting_soon';
      userId: string;
      tournamentId: string;
      tournamentTitle: string;
      startsAt: string;
      timestamp: string;
      correlationId?: string;
    }
  | {
      eventType: 'tournament.completed';
      userId: string;
      tournamentId: string;
      tournamentTitle: string;
      rank: number;
      totalParticipants: number;
      timestamp: string;
      correlationId?: string;
    }
  | {
      eventType: 'tournament.won';
      userId: string;
      tournamentId: string;
      tournamentTitle: string;
      rank: number;
      prize?: string;
      timestamp: string;
      correlationId?: string;
    };
