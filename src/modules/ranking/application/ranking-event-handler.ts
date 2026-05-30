/**
 * Ranking Event Handler
 *
 * Handles events from other domains (e.g., xp.earned from attempt domain).
 * Part of Phase 1 & 2 Integration.
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { XpIngestionService } from '../application/xp-ingestion.service';
import type { ExternalEventBusPort } from '../domain/ports/ranking-event-bus.port';

@Injectable()
export class RankingEventHandler implements OnModuleInit {
  constructor(
    private readonly xpIngestionService: XpIngestionService,
    @Inject('EXTERNAL_EVENT_BUS')
    private readonly externalEventBus: ExternalEventBusPort,
    @InjectPinoLogger(RankingEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribeToExternalEvents();
  }

  /**
   * Subscribe to events from other domains.
   */
  private subscribeToExternalEvents(): void {
    // Listen for XP earned events from attempt domain
    const unsubscribe = this.externalEventBus.subscribe(
      'external.xp.earned',
      this.handleXpEarned.bind(this),
    );

    this.logger.info({
      event: 'ranking_event_handler_subscribed',
    });

    // Store unsubscribe function for cleanup if needed
    this.unsubscribeFn = unsubscribe;
  }

  private unsubscribeFn?: () => void;

  /**
   * Handle XP earned events from other domains.
   */
  private async handleXpEarned(event: {
    userId: string;
    amount: number;
    source: string;
    attemptId?: string;
    tournamentId?: string;
    categoryId?: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.debug({
      event: 'external_xp_event_received',
      userId: event.userId,
      amount: event.amount,
      source: event.source,
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
      });
    } catch (error) {
      this.logger.error({
        event: 'xp_event_processing_failed',
        userId: event.userId,
        amount: event.amount,
        source: event.source,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
