/**
 * Profile Repository Port
 *
 * Interface for profile data access within the Profile domain.
 */

import type {
  ProfileRow,
  ProfileSettingsRow,
  ActivityEventRow,
  ActivityEventType,
} from '../types/profile.types';

export const PROFILE_REPOSITORY_PORT = Symbol('PROFILE_REPOSITORY_PORT');

export interface ProfileRepositoryPort {
  /**
   * Get user profile by user ID.
   */
  getProfile(userId: string): Promise<ProfileRow | null>;

  /**
   * Create a new profile for a user.
   */
  createProfile(userId: string): Promise<ProfileRow>;

  /**
   * Update profile display name.
   */
  updateDisplayName(userId: string, displayName: string): Promise<ProfileRow>;

  /**
   * Update profile avatar.
   */
  updateAvatar(userId: string, avatarUrl: string | null): Promise<ProfileRow>;

  /**
   * Update profile bio.
   */
  updateBio(userId: string, bio: string | null): Promise<ProfileRow>;

  /**
   * Update profile tagline.
   */
  updateTagline(userId: string, tagline: string | null): Promise<ProfileRow>;

  /**
   * Update pinned badges.
   */
  updatePinnedBadges(userId: string, badgeIds: string[]): Promise<ProfileRow>;
}

export const PROFILE_SETTINGS_REPOSITORY_PORT = Symbol('PROFILE_SETTINGS_REPOSITORY_PORT');

export interface ProfileSettingsRepositoryPort {
  /**
   * Get profile settings by user ID.
   */
  getSettings(userId: string): Promise<ProfileSettingsRow | null>;

  /**
   * Create default profile settings for a user.
   */
  createSettings(userId: string): Promise<ProfileSettingsRow>;

  /**
   * Update visibility setting.
   */
  updateVisibility(userId: string, isPublic: boolean): Promise<ProfileSettingsRow>;

  /**
   * Update a specific visibility flag.
   */
  updateVisibilityFlag(
    userId: string,
    flag:
      | 'showStatistics'
      | 'showAchievements'
      | 'showActivity'
      | 'showRankImprovement'
      | 'showTournamentActivity',
    value: boolean,
  ): Promise<ProfileSettingsRow>;
}

export const ACTIVITY_EVENT_REPOSITORY_PORT = Symbol('ACTIVITY_EVENT_REPOSITORY_PORT');

export interface ActivityEventRepositoryPort {
  /**
   * Record a new activity event.
   */
  recordEvent(params: {
    userId: string;
    eventType: ActivityEventType;
    metadata?: Record<string, unknown>;
    visibility?: 'public' | 'private';
    occurredAt?: Date;
  }): Promise<ActivityEventRow>;

  /**
   * Get activity timeline for a user.
   */
  getTimeline(
    userId: string,
    params?: {
      limit?: number;
      offset?: number;
      includePrivate?: boolean;
    },
  ): Promise<ActivityEventRow[]>;

  /**
   * Get events of specific types.
   */
  getEventsByType(
    userId: string,
    eventTypes: ActivityEventType[],
    params?: {
      limit?: number;
    },
  ): Promise<ActivityEventRow[]>;

  /**
   * Delete old events (for cleanup).
   */
  deleteOldEvents(userId: string, beforeDate: Date): Promise<number>;
}
