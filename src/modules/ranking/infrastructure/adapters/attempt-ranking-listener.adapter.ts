/**
 * Attempt Ranking Listener Adapter
 *
 * Subscribes to AttemptDomainEventBus for attempt completion events and triggers
 * XP ingestion into the Ranking domain. This is the primary path for routing
 * completed attempts from the Attempt domain into the Ranking domain.
 *
 * Architecture:
 * - Subscribes to ATTEMPT_DOMAIN_EVENT_BUS (a proper module port, not CommonExternalEventBus)
 * - Calls XpIngestionService.processXpEvent() which handles:
 *     1. Atomic XP update in the same DB transaction as the outbox row
 *     2. Deferred rank recalculation via RankingOutboxProcessorService
 *
 * This adapter represents the "correct" integration path per the cross-module
 * event contract. The RankingEventHandler (EXTERNAL_EVENT_BUS path) is kept
 * as a secondary fallback for other XP sources (tournament, achievement, bonus).
 *
 * See: cross-module-integration-audit.md — Bug #1 fix
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ATTEMPT_DOMAIN_EVENT_BUS } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import { AttemptCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';
import { XpIngestionService } from '../../domain/services/xp-ingestion.service';

@Injectable()
export class AttemptRankingListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptEventBus: AttemptDomainEventBusPort,
    private readonly xpIngestionService: XpIngestionService,
    @InjectPinoLogger(AttemptRankingListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.attemptEventBus.subscribe((event: unknown) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'attempt_ranking_listener_subscribed',
      bus: 'ATTEMPT_DOMAIN_EVENT_BUS',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: unknown): Promise<void> {
    if (!(event instanceof AttemptCompletedEvent)) return;

    this.logger.debug({
      event: 'attempt_completed_received_for_ranking',
      attemptId: event.attemptId,
      userId: event.userId,
      xpEarned: event.xpEarned,
      quizId: event.quizId,
    });

    if (event.xpEarned <= 0) {
      this.logger.debug({
        event: 'attempt_xp_zero_skip',
        attemptId: event.attemptId,
        userId: event.userId,
      });
      return;
    }

    try {
      await this.xpIngestionService.processXpEvent({
        eventType: 'external.xp.earned',
        userId: event.userId,
        amount: event.xpEarned,
        source: 'quiz_attempt',
        attemptId: event.attemptId,
        timestamp: event.timestamp,
      });

      this.logger.info({
        event: 'attempt_ranking_xp_processed',
        attemptId: event.attemptId,
        userId: event.userId,
        xpEarned: event.xpEarned,
      });
    } catch (error) {
      this.logger.error({
        event: 'attempt_ranking_xp_processing_failed',
        attemptId: event.attemptId,
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
