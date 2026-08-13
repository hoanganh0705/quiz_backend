/**
 * Achievement → Coin Listener Adapter
 *
 * Subscribes to `BadgeEarnedEvent` and grants `BADGE_REWARD` (20
 * coins) per badge earned. The badge type is stamped onto the ledger
 * `metadata` jsonb so the wallet history UI can render the icon
 * inline without a follow-up join.
 *
 * Idempotency: the derived key (`coin:{userId}:badge:{badgeType}`)
 * is unique per (user, badgeType). If the same badge is somehow
 * re-emitted (e.g. a re-grant path), the second event hits the outbox
 * partial unique index and is silently dropped at the producer
 * boundary. This means even if the achievement module accidentally
 * fires the event twice for the same badge the user is paid once.
 *
 * Daily cap: badges bypass the cap by product design (a milestone,
 * not a per-attempt reward).
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ACHIEVEMENT_DOMAIN_EVENT_BUS,
  type AchievementDomainEventBus,
} from '@/modules/achievement/domain/events/achievement-domain.event-bus';
import type { BadgeEarnedEvent } from '@/modules/achievement/domain/events/achievement.events';
import {
  COIN_INGESTION_PORT,
  type CoinIngestionPort,
} from '../../domain/ports/coin-ingestion.port';
import { COIN_REWARDS } from '../../coin.constants';

@Injectable()
export class AchievementCoinListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private subscription: { unsubscribe: () => void } | null = null;

  constructor(
    @Inject(ACHIEVEMENT_DOMAIN_EVENT_BUS)
    private readonly achievementBus: AchievementDomainEventBus,
    @Inject(COIN_INGESTION_PORT)
    private readonly coinIngestion: CoinIngestionPort,
    @InjectPinoLogger(AchievementCoinListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscription = this.achievementBus.subscribe(
      'badge.earned',
      this.onBadgeEarned.bind(this),
    );
    this.logger.info({ event: 'achievement_coin_listener_started' });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private async onBadgeEarned(event: BadgeEarnedEvent): Promise<void> {
    try {
      await this.coinIngestion.processCoinEvent({
        userId: event.userId,
        source: 'badge',
        amount: COIN_REWARDS.BADGE_REWARD,
        reason: 'BADGE_REWARD',
        referenceId: event.badgeType,
        metadata: {
          badgeType: event.badgeType,
          awardedAt: event.awardedAt.toISOString(),
        },
        // Badges bypass the daily cap by product design.
        applyDailyCap: false,
      });

      this.logger.info({
        event: 'badge_coin_grant_processed',
        userId: event.userId,
        badgeType: event.badgeType,
        amount: COIN_REWARDS.BADGE_REWARD,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_coin_listener_error',
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
