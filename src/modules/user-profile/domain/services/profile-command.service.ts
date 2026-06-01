/**
 * Profile Command Service
 *
 * Handles profile mutations (write side of CQRS-lite).
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ProfileRepositoryPort,
  PROFILE_REPOSITORY_PORT,
  ProfileSettingsRepositoryPort,
  PROFILE_SETTINGS_REPOSITORY_PORT,
} from '../ports/profile-repository.port';
import type { ProfileRow, ProfileSettingsRow } from '../types/profile.types';

@Injectable()
export class ProfileCommandService {
  constructor(
    @Inject(PROFILE_REPOSITORY_PORT)
    private readonly profileRepository: ProfileRepositoryPort,
    @Inject(PROFILE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: ProfileSettingsRepositoryPort,
    @InjectPinoLogger(ProfileCommandService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Initialize a profile for a new user.
   */
  async initializeProfile(userId: string): Promise<{ profile: ProfileRow; settings: ProfileSettingsRow }> {
    const [profile, settings] = await Promise.all([
      this.profileRepository.createProfile(userId),
      this.settingsRepository.createSettings(userId),
    ]);

    this.logger.info({
      event: 'profile_initialized',
      userId,
      profileId: profile.profileId,
    });

    return { profile, settings };
  }

  /**
   * Update display name.
   */
  async updateDisplayName(userId: string, displayName: string): Promise<ProfileRow> {
    return this.profileRepository.updateDisplayName(userId, displayName);
  }

  /**
   * Update avatar.
   */
  async updateAvatar(userId: string, avatarUrl: string | null): Promise<ProfileRow> {
    return this.profileRepository.updateAvatar(userId, avatarUrl);
  }

  /**
   * Update bio.
   */
  async updateBio(userId: string, bio: string | null): Promise<ProfileRow> {
    return this.profileRepository.updateBio(userId, bio);
  }

  /**
   * Update tagline.
   */
  async updateTagline(userId: string, tagline: string | null): Promise<ProfileRow> {
    return this.profileRepository.updateTagline(userId, tagline);
  }

  /**
   * Update pinned badges.
   */
  async updatePinnedBadges(userId: string, badgeIds: string[]): Promise<ProfileRow> {
    return this.profileRepository.updatePinnedBadges(userId, badgeIds);
  }

  /**
   * Update profile visibility.
   */
  async updateVisibility(userId: string, isPublic: boolean): Promise<ProfileSettingsRow> {
    return this.settingsRepository.updateVisibility(userId, isPublic);
  }

  /**
   * Update a visibility flag.
   */
  async updateVisibilityFlag(
    userId: string,
    flag: 'showStatistics' | 'showAchievements' | 'showActivity' | 'showRankImprovement' | 'showTournamentActivity',
    value: boolean,
  ): Promise<ProfileSettingsRow> {
    return this.settingsRepository.updateVisibilityFlag(userId, flag, value);
  }
}
