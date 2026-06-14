/**
 * Ranking Event Handler
 *
 * Handles events from other domains (e.g., xp.earned from attempt domain).
 * Placed in domain/events/ to match quiz module conventions where the
 * event bus and related event infrastructure live in domain/events/.
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { ExternalXpEarnedEvent } from './ranking-domain.events';
import { XpIngestionService } from '../services/xp-ingestion.service';
import { EXTERNAL_EVENT_BUS_CONSUMER_PORT } from '@/common/events';
import type { ExternalEventBusConsumerPort } from '@/common/events/common-external-event-bus';

@Injectable()
export class RankingEventHandler implements OnModuleInit {
  private unsubscribeFn?: () => void;

  constructor(
    private readonly xpIngestionService: XpIngestionService,
    @Inject(EXTERNAL_EVENT_BUS_CONSUMER_PORT)
    private readonly externalEventBus: ExternalEventBusConsumerPort,
    @InjectPinoLogger(RankingEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribeToExternalEvents();
  }

  private subscribeToExternalEvents(): void {
    this.unsubscribeFn = this.externalEventBus.subscribe(
      'external.xp.earned',
      this.handleXpEarned.bind(this),
    );

    this.logger.info({
      event: 'ranking_event_handler_subscribed',
    });
  }

  private async handleXpEarned(
    event: Omit<ExternalXpEarnedEvent, 'eventType'> & {
      eventType?: ExternalXpEarnedEvent['eventType'];
    },
  ): Promise<void> {
    this.logger.debug({
      event: 'external_xp_event_received',
      userId: event.userId,
      amount: event.amount,
      source: event.source,
      correlationId: event.correlationId,
    });

    try {
      await this.xpIngestionService.processXpEvent({
        eventType: 'external.xp.earned',
        ...event,
      });

      this.logger.info({
        event: 'xp_event_processed',
        userId: event.userId,
        amount: event.amount,
        source: event.source,
        correlationId: event.correlationId,
      });
    } catch (error) {
      this.logger.error({
        event: 'xp_event_processing_failed',
        userId: event.userId,
        amount: event.amount,
        source: event.source,
        correlationId: event.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
