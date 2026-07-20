/**
 * Tournament Outbox Processor Service
 *
 * Background job that reads unprocessed tournament domain events from the
 * outbox table and replays them to:
 *   1. The internal tournament event bus (for notification handlers like
 *      `TournamentListenerAdapter`, `TournamentAttemptEventListenerAdapter`)
 *   2. The shared tournament event bus (for cross-module consumers like
 *      achievements and social feed)
 *
 * For `tournament.won` events, this processor also publishes an
 * `ExternalXpEarnedEvent` to the external XP event bus so the ranking
 * module can credit the user's XP ledger.
 *
 * Retry strategy:
 *   delay = base_delay_seconds × 2^(attemptCount - 1)
 *   With base=30s: 30s → 60s → 2m → 4m → 8m → 16m → 32m → 64m
 *
 * After 8 attempts the event is moved to DLQ (failed_at + dlq_reason set).
 *
 * Issue #5 (Events Lost After Commit) — the transactional outbox guarantees
 * at-least-once delivery by persisting events in the same DB transaction as
 * the business write. The processor drains the outbox reliably.
 *
 * Issue #41 (Dual Delivery) — the processor dispatches to both the internal
 * bus and shared bus. In-process handlers (`TournamentListenerAdapter`) are
 * moved to subscribe to the outbox processor's direct dispatch instead of the
 * BullMQ bus, eliminating the duplicate delivery from the previous architecture.
 *
 * Issue #9 (XP Idempotency) — the `ExternalXpEarnedEvent` published by this
 * processor carries `idempotencyKey: ${tournamentId}:${userId}:${rank}`, which
 * the XP consumer uses for at-most-once deduplication.
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { TournamentDomainEventBusPort } from '../../domain/ports';
import { TOURNAMENT_DOMAIN_EVENT_BUS } from '../../domain/ports';
import {
  SHARED_TOURNAMENT_EVENT_BUS,
  type SharedTournamentEventBusPort,
  type SharedTournamentDomainEvent,
} from '@/common/events/tournament-shared-events';
import {
  type ExternalXpEarnedEvent,
  EXTERNAL_EVENT_BUS_PRODUCER_PORT,
  type ExternalEventBusProducerPort,
} from '@/common/events/common-external-event-bus';
import {
  TournamentJoinedEvent,
  TournamentParticipantWithdrawnEvent,
  TournamentStartingSoonEvent,
  TournamentCompletedEvent,
  TournamentWonEvent,
  type TournamentDomainEvent,
} from '../../domain/events';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const TOURNAMENT_OUTBOX_MAX_RETRIES = 8;
const TOURNAMENT_OUTBOX_BASE_DELAY_SECONDS = 30;

type OutboxEventRow = {
  eventId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  idempotencyKey: string | null;
  correlationId: string | null;
};

function computeTournamentXp(rank: number): number {
  if (rank === 1) return 1000;
  if (rank <= 3) return 500;
  if (rank <= 10) return 200;
  if (rank <= 25) return 100;
  if (rank <= 50) return 50;
  return 20;
}

@Injectable()
export class TournamentOutboxProcessorService implements OnModuleInit {
  private readonly BATCH_SIZE = 100;
  private readonly processedInRun = new Set<string>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly internalEventBus: TournamentDomainEventBusPort,
    @Inject(SHARED_TOURNAMENT_EVENT_BUS)
    private readonly sharedEventBus: SharedTournamentEventBusPort,
    @Inject(EXTERNAL_EVENT_BUS_PRODUCER_PORT)
    private readonly externalEventBus: ExternalEventBusProducerPort,
    @InjectPinoLogger(TournamentOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({ event: 'tournament_outbox_processor_started' });
  }

  /**
   * Drain a batch of unprocessed tournament outbox events.
   *
   * Called by `TournamentOutboxSchedulerService` on a cron schedule.
   * Returns the number of successfully processed rows.
   */
  async processPendingEvents(): Promise<{ processed: number; failed: number }> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateType, 'tournament'),
          isNull(outboxEvents.processedAt),
          isNull(outboxEvents.failedAt),
          lte(outboxEvents.nextAttemptAt, nowIso),
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(this.BATCH_SIZE);

    if (events.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const event of events as OutboxEventRow[]) {
      // Guard: if we already processed this eventId in this drain run, skip it.
      // This protects against the same row being selected twice if new events
      // arrive mid-run.
      if (this.processedInRun.has(event.eventId)) {
        continue;
      }

      try {
        await this.dispatchEvent(event);
        await this.markProcessed(event.eventId);
        this.processedInRun.add(event.eventId);
        processed += 1;
        this.logger.debug({
          event: 'tournament_outbox_processed',
          eventType: event.eventType,
          eventId: event.eventId,
          idempotencyKey: event.idempotencyKey,
        });
      } catch (error) {
        if (this.isIdempotencyConflict(error)) {
          // Unique constraint hit: another instance processed it. Mark done.
          await this.markProcessed(event.eventId);
          this.processedInRun.add(event.eventId);
          processed += 1;
          this.logger.debug({
            event: 'tournament_outbox_event_skipped_idempotent',
            outboxEventId: event.eventId,
            eventType: event.eventType,
          });
          continue;
        }

        await this.handleFailure(event, error);
        failed += 1;
      }
    }

    if (processed > 0 || failed > 0) {
      this.logger.info({
        event: 'tournament_outbox_processor_completed',
        processed,
        failed,
        scannedCount: events.length,
      });
    }

    return { processed, failed };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async dispatchEvent(event: OutboxEventRow): Promise<void> {
    const domainEvent = this.deserializePayload(event);
    if (!domainEvent) {
      throw new Error(`unknown tournament event type: ${event.eventType}`);
    }

    const correlationId = event.correlationId ?? createCorrelationId();

    // Restore correlation ID to AsyncLocalStorage so downstream handlers
    // can read it via getCorrelationId() without generating new ones.
    // correlationIdStorage.run is synchronous; intentionally not awaited.
    void correlationIdStorage.run({ correlationId }, () => {
      // Dispatch #1: Internal bus → notification handlers
      // (TournamentListenerAdapter, TournamentAttemptEventListenerAdapter)
      this.internalEventBus.publish(domainEvent);

      // Dispatch #2: Shared bus → cross-module consumers
      // (AchievementService, SocialFeedService via SharedTournamentEventBusAdapter)
      const sharedEvent = this.toSharedEvent(domainEvent);
      if (sharedEvent) {
        this.sharedEventBus.publish(sharedEvent);
      }

      // Dispatch #3: External XP bus for tournament.won events
      // Issue #9 — idempotent XP grant via idempotencyKey on ExternalXpEarnedEvent
      if (domainEvent.eventType === 'tournament.won') {
        const won = domainEvent;
        const xp = computeTournamentXp(won.rank);
        if (xp > 0) {
          const xpEvent: ExternalXpEarnedEvent = {
            eventType: 'external.xp.earned',
            userId: won.userId,
            amount: xp,
            source: 'tournament',
            tournamentId: won.tournamentId,
            idempotencyKey: `${won.tournamentId}:${won.userId}:${won.rank}`,
            rank: won.rank,
            correlationId,
            timestamp: won.timestamp,
          };
          void this.externalEventBus.publishXpEarned(xpEvent);
          this.logger.debug({
            event: 'tournament_xp_dispatched',
            userId: won.userId,
            tournamentId: won.tournamentId,
            rank: won.rank,
            xp,
            idempotencyKey: xpEvent.idempotencyKey,
          });
        }
      }
    });
  }

  private deserializePayload(event: OutboxEventRow): TournamentDomainEvent | null {
    const p = event.payload;
    switch (event.eventType) {
      case 'tournament.joined':
        return new TournamentJoinedEvent(
          p['tournamentId'] as string,
          p['userId'] as string,
          p['tournamentTitle'] as string,
          new Date(p['timestamp'] as string),
        );
      case 'tournament.participant.withdrawn':
        return new TournamentParticipantWithdrawnEvent(
          p['tournamentId'] as string,
          p['userId'] as string,
          new Date(p['timestamp'] as string),
        );
      case 'tournament.starting_soon':
        return new TournamentStartingSoonEvent(
          p['userId'] as string,
          p['tournamentId'] as string,
          p['tournamentTitle'] as string,
          p['startsAt'] as string,
          new Date(p['timestamp'] as string),
        );
      case 'tournament.completed':
        return new TournamentCompletedEvent(
          p['userId'] as string,
          p['tournamentId'] as string,
          p['tournamentTitle'] as string,
          p['rank'] as number,
          p['totalParticipants'] as number,
          new Date(p['timestamp'] as string),
        );
      case 'tournament.won':
        return new TournamentWonEvent(
          p['userId'] as string,
          p['tournamentId'] as string,
          p['tournamentTitle'] as string,
          p['rank'] as number,
          p['prize'] as string | undefined,
          new Date(p['timestamp'] as string),
        );
      default:
        return null;
    }
  }

  private toSharedEvent(event: TournamentDomainEvent): SharedTournamentDomainEvent | null {
    switch (event.eventType) {
      case 'tournament.joined': {
        const e = event;
        return {
          eventType: 'tournament.joined',
          tournamentId: e.tournamentId,
          userId: e.userId,
          tournamentTitle: e.tournamentTitle,
          timestamp: e.occurredAt,
        };
      }
      case 'tournament.participant.withdrawn': {
        const e = event;
        return {
          eventType: 'tournament.participant.withdrawn',
          tournamentId: e.tournamentId,
          userId: e.userId,
          timestamp: e.withdrawnAt,
        };
      }
      case 'tournament.won': {
        const e = event;
        return {
          eventType: 'tournament.won',
          tournamentId: e.tournamentId,
          userId: e.userId,
          tournamentTitle: e.tournamentTitle,
          rank: e.rank,
          timestamp: e.timestamp,
        };
      }
      // tournament.starting_soon and tournament.completed are not bridged
      // to the shared bus (no known cross-module consumers need them).
      default:
        return null;
    }
  }

  private async handleFailure(event: OutboxEventRow, error: unknown): Promise<void> {
    const nextAttemptCount = event.attemptCount + 1;
    const nowIso = new Date().toISOString();
    const nextAttemptAt = computeNextAttemptIso(nextAttemptCount, nowIso);
    const lastError = error instanceof Error ? error.message : String(error);

    const isDlq = nextAttemptCount > TOURNAMENT_OUTBOX_MAX_RETRIES;

    const updateValues: Record<string, unknown> = {
      attemptCount: nextAttemptCount,
      lastAttemptAt: nowIso,
      nextAttemptAt,
      lastError,
    };

    if (isDlq) {
      updateValues.failedAt = nowIso;
      updateValues.dlqReason = `exhausted_retries:${lastError}`;

      this.logger.error({
        event: 'tournament_outbox_event_dlq',
        outboxEventId: event.eventId,
        eventType: event.eventType,
        attemptCount: nextAttemptCount,
        maxRetries: TOURNAMENT_OUTBOX_MAX_RETRIES,
        message: lastError,
      });
    } else {
      this.logger.warn({
        event: 'tournament_outbox_event_retry_scheduled',
        outboxEventId: event.eventId,
        eventType: event.eventType,
        attemptCount: nextAttemptCount,
        nextAttemptAt,
        message: lastError,
      });
    }

    await this.db
      .update(outboxEvents)
      .set(updateValues)
      .where(and(eq(outboxEvents.eventId, event.eventId), isNull(outboxEvents.processedAt)));
  }

  private async markProcessed(eventId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.db
      .update(outboxEvents)
      .set({
        processedAt: nowIso,
        lastAttemptAt: nowIso,
      })
      .where(eq(outboxEvents.eventId, eventId));
  }

  private isIdempotencyConflict(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('duplicate') ||
        msg.includes('unique') ||
        msg.includes('23505') ||
        msg.includes('idempotency')
      );
    }
    return false;
  }
}

function computeNextAttemptIso(attemptCount: number, nowIso: string): string {
  const exponent = Math.max(0, attemptCount - 1);
  const delaySeconds = TOURNAMENT_OUTBOX_BASE_DELAY_SECONDS * 2 ** exponent;
  const next = new Date(nowIso);
  next.setUTCSeconds(next.getUTCSeconds() + delaySeconds);
  return next.toISOString();
}
