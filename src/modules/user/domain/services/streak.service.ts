/**
 * Streak Service
 *
 * Calculates and updates user daily streak (currentStreak, longestStreak).
 * Persists the result via `UserRepository.updateStreakCache` and emits
 * `user.streak_updated` on the in-process `UserDomainEventBus` once the
 * persistence call returns.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { USER_DOMAIN_EVENT_BUS } from '../events/user-domain-event-bus.port';
import type { UserDomainEventBusPort } from '../events/user-domain-event-bus.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../ports/user-repository.port';
import { UserStreakUpdatedEvent } from '../events/user-domain.events';

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
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(StreakService.name)
    private readonly logger: PinoLogger,
  ) {}

  async recalculateStreak(userId: string, attemptTimestamp: Date): Promise<StreakResult> {
    const previous = await this.userRepository.findMeById(userId);
    if (!previous) {
      this.logger.warn({
        event: 'user_streak_recalculate_skipped_user_not_found',
        userId,
      });
      return { currentStreak: 0, longestStreak: 0, previousStreak: 0, isNewRecord: false };
    }

    const updated = await this.userRepository.updateStreakCache(userId, attemptTimestamp);
    if (!updated) {
      this.logger.warn({
        event: 'user_streak_recalculate_skipped_soft_deleted',
        userId,
      });
      return {
        currentStreak: previous.currentStreak,
        longestStreak: previous.longestStreak,
        previousStreak: previous.currentStreak,
        isNewRecord: false,
      };
    }

    const previousStreak = previous.currentStreak;
    const currentStreak = updated.currentStreak;
    const longestStreak = updated.longestStreak;
    const isNewRecord = currentStreak > longestStreak || longestStreak > previous.longestStreak;

    this.userEventBus.emitStreakUpdated(
      new UserStreakUpdatedEvent(
        userId,
        currentStreak,
        longestStreak,
        previousStreak,
        isNewRecord,
        attemptTimestamp,
      ),
    );

    this.logger.info({
      event: 'user_streak_updated',
      userId,
      previousStreak,
      currentStreak,
      longestStreak,
      isNewRecord,
    });

    return { currentStreak, longestStreak, previousStreak, isNewRecord };
  }
}
