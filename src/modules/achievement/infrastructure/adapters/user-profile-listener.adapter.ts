/**
 * User Profile Event Listener Adapter
 *
 * Listens to User Profile domain events and triggers achievement evaluation.
 * This adapter bridges the User Profile domain to the Achievement domain.
 *
 * Events consumed:
 * - profile.initialized: Triggers first-time/user badges
 * - profile.updated: May trigger certain progress badges
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';

export interface ProfileInitializedEvent {
  readonly eventType: 'profile.initialized';
  readonly userId: string;
  readonly timestamp: Date;
}

export interface ProfileUpdatedEvent {
  readonly eventType: 'profile.updated';
  readonly userId: string;
  readonly changes: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface ProfileVisibilityChangedEvent {
  readonly eventType: 'profile.visibility_changed';
  readonly userId: string;
  readonly isPublic: boolean;
  readonly timestamp: Date;
}

export type ProfileDomainEvent = ProfileInitializedEvent | ProfileUpdatedEvent | ProfileVisibilityChangedEvent;

@Injectable()
export class UserProfileEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(UserProfileEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.logger.info({
      event: 'achievement_user_profile_listener_subscribed',
    });
  }

  /**
   * Handle profile initialized event.
   * This is triggered when a new user profile is created.
   */
  async handleProfileInitialized(event: ProfileInitializedEvent): Promise<void> {
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'profile.created',
        eventData: {
          createdAt: event.timestamp,
        },
      });

      this.logger.info({
        event: 'profile_initialized_evaluated',
        userId: event.userId,
        badgesAwarded: results.filter((r) => r.awarded).length,
        results,
      });
    } catch (error) {
      this.logger.error({
        event: 'profile_initialized_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle profile updated event.
   * Used for certain progress-based achievements.
   */
  async handleProfileUpdated(event: ProfileUpdatedEvent): Promise<void> {
    try {
      // Profile updates don't typically trigger badges directly
      // but we log for potential future use
      this.logger.debug({
        event: 'profile_updated_received',
        userId: event.userId,
        changes: event.changes,
      });
    } catch (error) {
      this.logger.error({
        event: 'profile_updated_handling_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle profile visibility changed event.
   */
  async handleProfileVisibilityChanged(event: ProfileVisibilityChangedEvent): Promise<void> {
    try {
      // Visibility changes might trigger social badges in the future
      this.logger.debug({
        event: 'profile_visibility_changed_received',
        userId: event.userId,
        isPublic: event.isPublic,
      });
    } catch (error) {
      this.logger.error({
        event: 'profile_visibility_changed_handling_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
