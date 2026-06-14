/**
 * Ranking XP Streak Listener Adapter
 *
 * Subscribes to Ranking domain events to maintain the user's daily activity streak
 * whenever XP is earned from any source (quiz attempt, tournament, achievement, bonus).
 *
 * Background:
 *   `xp.added` events were previously emitted to RANKING_DOMAIN_EVENT_BUS but had no
 *   external consumers (per cross-module-integration-audit.md). The StreakService in
 *   the User domain was designed to be triggered by XP-earning activity but had no
 *   callers. This adapter closes both gaps.
 *
 * Why xp.added (not attempt.completed)?
 *   - Attempts are the most common source of XP, but XP can also be earned from
 *     tournaments, achievements, or admin bonuses. Hooking into xp.added gives
 *     uniform streak maintenance across all XP sources.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
  type PublishedRankingDomainEvent,
} from '@/modules/ranking/domain/ports/ranking-event-bus.port';
import type { XpAddedEvent } from '@/modules/ranking/domain/events/ranking-domain.events';
import { StreakService } from '../../domain/services/streak.service';

@Injectable()
export class RankingXpStreakListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly rankingEventBus: RankingDomainEventBusPort,
    private readonly streakService: StreakService,
    @InjectPinoLogger(RankingXpStreakListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.rankingEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'ranking_xp_streak_listener_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: PublishedRankingDomainEvent): Promise<void> {
    if (event.eventType !== 'xp.added') return;

    await this.recordStreak(event);
  }

  private async recordStreak(event: XpAddedEvent): Promise<void> {
    try {
      await this.streakService.recalculateStreak(event.userId, event.timestamp);

      this.logger.debug({
        event: 'ranking_xp_streak_recorded',
        userId: event.userId,
        amount: event.amount,
        newAllTimeXp: event.newAllTimeXp,
      });
    } catch (error) {
      this.logger.error({
        event: 'ranking_xp_streak_recording_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
