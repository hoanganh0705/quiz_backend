import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  USER_DOMAIN_EVENT_BUS,
  type UserDomainEventBusPort,
} from '@/modules/user/domain/events/user-domain-event-bus.port';
import type { UserStreakUpdatedEvent } from '@/modules/user/domain/events/user-domain.events';
import {
  COIN_INGESTION_PORT,
  type CoinIngestionPort,
} from '../../domain/ports/coin-ingestion.port';
import { COIN_REWARDS } from '../../coin.constants';

const STREAK_MILESTONES = Object.freeze({
  3: COIN_REWARDS.STREAK_MILESTONE_3_DAYS,
  5: COIN_REWARDS.STREAK_MILESTONE_5_DAYS,
  7: COIN_REWARDS.STREAK_MILESTONE_7_DAYS,
  14: COIN_REWARDS.STREAK_MILESTONE_14_DAYS,
} as const);

type MilestoneDays = keyof typeof STREAK_MILESTONES;

@Injectable()
export class StreakCoinListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(USER_DOMAIN_EVENT_BUS)
    private readonly userBus: UserDomainEventBusPort,
    @Inject(COIN_INGESTION_PORT)
    private readonly coinIngestion: CoinIngestionPort,
    @InjectPinoLogger(StreakCoinListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.userBus.subscribe(this.onEvent.bind(this));
    this.logger.info({ event: 'streak_coin_listener_started' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async onEvent(event: unknown): Promise<void> {
    if (!this.isStreakUpdated(event)) return;
    if (!this.isMilestoneCrossing(event)) return;

    try {
      await this.coinIngestion.processCoinEvent({
        userId: event.userId,
        source: 'streak',
        amount: STREAK_MILESTONES[event.currentStreak as MilestoneDays],
        reason: 'STREAK_MILESTONE_REWARD',
        referenceId: String(event.currentStreak),
        metadata: {
          previousStreak: event.previousStreak,
          currentStreak: event.currentStreak,
          longestStreak: event.longestStreak,
          isNewRecord: event.isNewRecord,
        },
        applyDailyCap: false,
      });

      this.logger.info({
        event: 'streak_coin_grant_processed',
        userId: event.userId,
        milestoneDays: event.currentStreak,
        amount: STREAK_MILESTONES[event.currentStreak as MilestoneDays],
      });
    } catch (error) {
      this.logger.error({
        event: 'streak_coin_listener_error',
        userId: event.userId,
        milestoneDays: event.currentStreak,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isMilestoneCrossing(event: UserStreakUpdatedEvent): boolean {
    const days = event.currentStreak;
    if (!(days in STREAK_MILESTONES)) return false;
    const milestoneDay = days as MilestoneDays;
    return event.previousStreak + 1 === milestoneDay;
  }

  private isStreakUpdated(event: unknown): event is UserStreakUpdatedEvent {
    return (
      event instanceof Object &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'user.streak_updated'
    );
  }
}
