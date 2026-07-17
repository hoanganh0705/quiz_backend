/**
 * Streak Service
 *
 * Calculates and updates user daily streak (currentStreak, longestStreak).
 * Emits `user.streak_updated` on UserDomainEventBus when streak changes.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_DOMAIN_EVENT_BUS } from '../events/user-domain-event-bus.port';
import type { UserDomainEventBusPort } from '../events/user-domain-event-bus.port';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  previousStreak: number;
  isNewRecord: boolean;
}

@Injectable()
export class StreakService {
  constructor(
    @Inject(USER_DOMAIN_EVENT_BUS)
    private readonly userEventBus: UserDomainEventBusPort,
    @InjectPinoLogger(StreakService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Recalculate and persist the user's streak after an attempt.
   * Returns the updated streak result.
   *
   * The attempt completion timestamp is used to determine if the streak continues
   * (same UTC day as last attempt) or resets.
   */
  // TODO: Implement actual streak calculation with database queries
  // eslint-disable-next-line @typescript-eslint/require-await
  async recalculateStreak(userId: string, attemptTimestamp: Date): Promise<StreakResult> {
    const lastAttemptDate = null; // TODO: fetch from user record or attempt history
    const previousStreak = 0; // TODO: fetch from user record

    const today = this.utcDateString(attemptTimestamp);
    const yesterday = this.utcDateString(new Date(attemptTimestamp.getTime() - 86_400_000));

    let currentStreak: number;
    let longestStreak: number;
    let isNewRecord = false;

    if (lastAttemptDate === today) {
      // Already played today — streak unchanged
      currentStreak = previousStreak;
      longestStreak = previousStreak;
    } else if (lastAttemptDate === yesterday) {
      // Continuing streak
      currentStreak = previousStreak + 1;
      longestStreak = Math.max(previousStreak + 1, previousStreak);
    } else {
      // Streak broken — start fresh
      currentStreak = 1;
      longestStreak = previousStreak;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      isNewRecord = true;
    }

    const event = {
      eventType: 'user.streak_updated' as const,
      userId,
      currentStreak,
      longestStreak,
      previousStreak,
      isNewRecord,
      timestamp: attemptTimestamp,
    };

    this.userEventBus.emitStreakUpdated(event);

    this.logger.info({
      event: 'user_streak_updated',
      userId,
      currentStreak,
      longestStreak,
      previousStreak,
      isNewRecord,
    });

    return { currentStreak, longestStreak, previousStreak, isNewRecord };
  }

  private utcDateString(date: Date): string {
    return date.toISOString().substring(0, 10);
  }
}
