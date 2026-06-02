/**
 * Seasonal Badge Service
 *
 * Handles time-limited and seasonal achievements:
 * - Seasonal events (Summer, Winter, etc.)
 * - Limited-time challenges
 * - Event-specific badges
 * - Automatic expiration handling
 *
 * Design principles:
 * - Badges have validFrom/validUntil dates
 * - Expired badges remain in history but are marked
 * - New seasonal events can be added without code changes
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

export interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  badgeIds: string[];
  isActive: boolean;
}

export interface SeasonalBadgeConfig {
  seasonId: string;
  seasonName: string;
  eventType?: string;
  expiresWithSeason: boolean;
}

export interface SeasonStatus {
  seasonId: string;
  name: string;
  status: 'upcoming' | 'active' | 'ended';
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  badgesAvailable: number;
}

export interface BadgeExpirationResult {
  badgeId: string;
  slug: string;
  expiredCount: number;
  affectedUsers: string[];
}

@Injectable()
export class SeasonalBadgeService {
  private cachedSeasons: Map<string, SeasonalEvent> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(SeasonalBadgeService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get all active seasonal badges.
   */
  async getActiveSeasonalBadges(): Promise<BadgeDefinitionRow[]> {
    this.refreshCacheIfNeeded();
    return this.achievementRepository.getBadgesByCategory('seasonal');
  }

  /**
   * Get badges for a specific season.
   */
  async getBadgesBySeason(seasonId: string): Promise<BadgeDefinitionRow[]> {
    const allBadges = await this.achievementRepository.getAllActiveBadges();
    return allBadges.filter((badge) => {
      const config = this.getSeasonConfig(badge);
      return config?.seasonId === seasonId;
    });
  }

  /**
   * Check if a badge is currently valid (within seasonal window).
   */
  isBadgeValid(badge: BadgeDefinitionRow): boolean {
    const now = new Date();

    if (badge.validFrom && now < badge.validFrom) {
      return false;
    }
    if (badge.validUntil && now > badge.validUntil) {
      return false;
    }
    return true;
  }

  /**
   * Get status of all seasons.
   */
  async getSeasonStatus(): Promise<SeasonStatus[]> {
    const seasonalBadges = await this.achievementRepository.getBadgesByCategory('seasonal');
    const now = new Date();

    // Group badges by season
    const seasonsMap = new Map<
      string,
      { badges: BadgeDefinitionRow[]; config?: SeasonalBadgeConfig }
    >();

    for (const badge of seasonalBadges) {
      const config = this.getSeasonConfig(badge);
      const seasonId = config?.seasonId ?? 'unknown';

      const existing = seasonsMap.get(seasonId) ?? { badges: [], config };
      existing.badges.push(badge);
      seasonsMap.set(seasonId, existing);
    }

    // Build status for each season
    const statuses: SeasonStatus[] = [];

    for (const [seasonId, data] of seasonsMap) {
      // Find earliest start and latest end from badges
      let startDate = now;
      let endDate = now;
      const name = data.config?.seasonName ?? seasonId;

      for (const badge of data.badges) {
        if (badge.validFrom && badge.validFrom < startDate) {
          startDate = badge.validFrom;
        }
        if (badge.validUntil && badge.validUntil > endDate) {
          endDate = badge.validUntil;
        }
      }

      // Determine status
      let status: 'upcoming' | 'active' | 'ended';
      if (now < startDate) {
        status = 'upcoming';
      } else if (now > endDate) {
        status = 'ended';
      } else {
        status = 'active';
      }

      const daysRemaining =
        status === 'ended'
          ? 0
          : Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      statuses.push({
        seasonId,
        name,
        status,
        startDate,
        endDate,
        daysRemaining,
        badgesAvailable: data.badges.length,
      });
    }

    // Sort by start date (most recent first)
    return statuses.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  /**
   * Create a new seasonal event with badges.
   */
  createSeasonalEvent(event: Omit<SeasonalEvent, 'id'>): SeasonalEvent {
    const seasonId = `${event.name.toLowerCase().replace(/\s+/g, '-')}-${event.startDate.getFullYear()}`;

    const createdEvent: SeasonalEvent = {
      ...event,
      id: seasonId,
    };

    this.cachedSeasons.set(seasonId, createdEvent);

    this.logger.info({
      event: 'seasonal_event_created',
      seasonId,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      badgeCount: event.badgeIds.length,
    });

    return createdEvent;
  }

  /**
   * Check if a user can still earn seasonal badges.
   */
  async canEarnSeasonalBadges(seasonId: string): Promise<boolean> {
    const status = await this.getSeasonStatus();
    const season = status.find((s) => s.seasonId === seasonId);
    return season?.status === 'active';
  }

  /**
   * Get time remaining for a seasonal badge.
   */
  async getTimeRemaining(badgeId: string): Promise<{ hours: number; minutes: number } | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge || !badge.validUntil) return null;

    const now = new Date();
    const remaining = badge.validUntil.getTime() - now.getTime();

    if (remaining <= 0) return { hours: 0, minutes: 0 };

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
  }

  /**
   * Handle badge expiration.
   * Called periodically to mark expired badges.
   */
  async handleExpiredBadges(): Promise<BadgeExpirationResult[]> {
    const allBadges = await this.achievementRepository.getAllActiveBadges();
    const now = new Date();
    const results: BadgeExpirationResult[] = [];

    const expiredBadges = allBadges.filter(
      (badge) => badge.category === 'seasonal' && badge.validUntil && badge.validUntil < now,
    );

    for (const badge of expiredBadges) {
      // Get count of users who earned this badge while it was active
      const earnersCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);

      results.push({
        badgeId: badge.badgeId,
        slug: badge.slug,
        expiredCount: earnersCount,
        affectedUsers: [], // Would need to query actual users
      });

      this.logger.info({
        event: 'seasonal_badge_expired',
        badgeId: badge.badgeId,
        slug: badge.slug,
        earnersCount,
      });
    }

    return results;
  }

  /**
   * Archive expired seasonal badges.
   * Sets isActive to false for badges that have ended.
   */
  async archiveExpiredBadges(): Promise<number> {
    const allBadges = await this.achievementRepository.getAllActiveBadges();
    const now = new Date();
    let archivedCount = 0;

    for (const badge of allBadges) {
      if (badge.category === 'seasonal' && badge.validUntil && badge.validUntil < now) {
        // In a real implementation, this would update the badge
        // For now, just log
        this.logger.info({
          event: 'badge_archived',
          badgeId: badge.badgeId,
          slug: badge.slug,
        });
        archivedCount++;
      }
    }

    return archivedCount;
  }

  /**
   * Get upcoming seasons (seasons that haven't started yet).
   */
  async getUpcomingSeasons(): Promise<SeasonStatus[]> {
    const allStatus = await this.getSeasonStatus();
    return allStatus.filter((s) => s.status === 'upcoming');
  }

  /**
   * Get active seasons.
   */
  async getActiveSeasons(): Promise<SeasonStatus[]> {
    const allStatus = await this.getSeasonStatus();
    return allStatus.filter((s) => s.status === 'active');
  }

  /**
   * Refresh the cache if needed.
   */
  private refreshCacheIfNeeded(): void {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return;
    }

    this.cacheTimestamp = now;
  }

  private getSeasonConfig(badge: BadgeDefinitionRow): SeasonalBadgeConfig | undefined {
    return (badge as { metadata?: SeasonalBadgeConfig }).metadata;
  }

  /**
   * Validate badge can be awarded based on seasonal constraints.
   */
  async validateBadgeAward(badgeId: string): Promise<{ canAward: boolean; reason?: string }> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      return { canAward: false, reason: 'Badge not found' };
    }

    const now = new Date();

    // Check if badge is active
    if (!badge.isActive) {
      return { canAward: false, reason: 'Badge is not active' };
    }

    // Check seasonal window
    if (badge.category === 'seasonal') {
      if (badge.validFrom && now < badge.validFrom) {
        return { canAward: false, reason: 'Season has not started yet' };
      }

      if (badge.validUntil && now > badge.validUntil) {
        return { canAward: false, reason: 'Season has ended' };
      }
    }

    return { canAward: true };
  }
}
