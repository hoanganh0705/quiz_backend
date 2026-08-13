/**
 * Streak → Coin Listener Adapter
 *
 * Subscribes to `UserStreakUpdatedEvent` and grants a milestone
 * reward when the streak crosses one of the milestone thresholds
 * defined in `COIN_REWARDS`:
 *
 *   - 3 days  → 25 coins (`STREAK_MILESTONE_3_DAYS`)
 *   - 5 days  → 50 coins (`STREAK_MILESTONE_5_DAYS`)
 *   - 7 days  → 75 coins (`STREAK_MILESTONE_7_DAYS`)
 *   - 14 days → 150 coins (`STREAK_MILESTONE_14_DAYS`)
 *
 * Per the design doc the listener fires **only** when
 * `previousStreak + 1 === currentStreak === milestoneDays` — i.e. the
 * moment the streak crosses the threshold — to guarantee the milestone
 * grant is paid exactly once per crossing. Subsequent events with
 * `currentStreak > milestoneDays` are ignored because the next event
 * is `previousStreak + 1 === nextMilestone`, and the daily-cap pass is
 * skipped (streak rewards are once-per-milestone by design).
 *
 * Idempotency: the derived key (`coin:{userId}:streak:{streakDays}`)
 * is stable per milestone crossing. A retry of the same event hits the
 * outbox partial unique index and is silently skipped.
 */

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
        // Streak milestones bypass the daily cap by product design.
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

  /**
   * Crossing rule (per design doc §9.4): the streak moved from N to
   * N+1, and N+1 is a milestone day. Built-in milestones are
   * { 3, 5, 7, 14 }. With `previousStreak = 2`, `currentStreak = 3`
   * is a crossing; with `previousStreak = 4`, `currentStreak = 5` is
   * a crossing; etc.
   */
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
