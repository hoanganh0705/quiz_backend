import { Injectable } from '@nestjs/common';
import { UserAccountRepository } from './aggregates/user-account.repository';
import { UserProfileRepository } from './aggregates/user-profile.repository';
import { UserSettingsRepository } from './aggregates/user-settings.repository';
import { UserBadgeRepository } from './aggregates/user-badge.repository';
import { UserRankingRepository } from './aggregates/user-ranking.repository';
import { UserActivityRepository } from './aggregates/user-activity.repository';
import { UserTournamentRepository } from './aggregates/user-tournament.repository';
import { UserAnalyticsRepository } from './aggregates/user-analytics.repository';
import { assembleUserMeRow } from './aggregates/user-me-row.builder';
import type { DrizzleDB } from '@/core/database/database.module';
import type {
  UserRepositoryPort,
  UserMeRow,
  UserBadgeRow,
  UserRankingRow,
  UserActivityRow,
  MyTournamentRow,
  MyTournamentHistoryRow,
  PublicTournamentProfileRow,
  MyTournamentAnalyticsRow,
  StreakCacheUpdateResult,
  ModeratorRole,
  UserPublicRow,
  UserLookupRow,
} from '../../domain/ports/user-repository.port';
import type { UserAnalytics } from '../../domain/types/user-analytics';

@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(
    private readonly account: UserAccountRepository,
    private readonly profile: UserProfileRepository,
    private readonly settings: UserSettingsRepository,
    private readonly badges: UserBadgeRepository,
    private readonly ranking: UserRankingRepository,
    private readonly activity: UserActivityRepository,
    private readonly tournament: UserTournamentRepository,
    private readonly analytics: UserAnalyticsRepository,
  ) {}

  async findMeById(userId: string): Promise<UserMeRow | null> {
    return this.account.findMeById(userId);
  }

  async findAvatarPublicIdByUserId(userId: string): Promise<string | null> {
    return this.profile.findAvatarPublicIdByUserId(userId);
  }

  async findUserProfileSettings(userId: string): Promise<{ isPublic: boolean } | null> {
    return this.settings.findUserProfileSettings(userId);
  }

  async findUserPrivacyFlags(userId: string): Promise<{
    isPublic: boolean;
    showStatistics: boolean;
    showAchievements: boolean;
    showActivity: boolean;
    showRankImprovement: boolean;
    showTournamentActivity: boolean;
  } | null> {
    return this.settings.findUserPrivacyFlags(userId);
  }

  async listUserBadges(params: {
    userId: string;
    limit: number;
    cursor?: { earnedAt: string; userBadgeId: string } | null;
  }): Promise<UserBadgeRow[]> {
    return this.badges.listUserBadges(params);
  }

  async getUserRanking(userId: string): Promise<UserRankingRow | null> {
    return this.ranking.getUserRanking(userId);
  }

  async createUserRanking(userId: string): Promise<UserRankingRow> {
    return this.ranking.createUserRanking(userId);
  }

  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    return this.analytics.getUserAnalytics(userId);
  }

  async listUserActivity(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; eventId: string } | null;
  }): Promise<UserActivityRow[]> {
    return this.activity.listUserActivity(params);
  }

  async listMyTournaments(params: {
    userId: string;
    limit: number;
    cursor?: { registeredAt: string; participantId: string } | null;
  }): Promise<{ items: MyTournamentRow[]; hasNextPage: boolean }> {
    return this.tournament.listMyTournaments(params);
  }

  async listMyTournamentHistory(params: {
    userId: string;
    limit: number;
    cursor?: { completedAt: string; participantId: string } | null;
  }): Promise<{ items: MyTournamentHistoryRow[]; hasNextPage: boolean }> {
    return this.tournament.listMyTournamentHistory(params);
  }

  async getPublicTournamentProfile(userId: string): Promise<PublicTournamentProfileRow> {
    return this.tournament.getPublicTournamentProfile(userId);
  }

  async getMyTournamentAnalytics(userId: string): Promise<MyTournamentAnalyticsRow> {
    return this.tournament.getMyTournamentAnalytics(userId);
  }

  async updateProfile(
    userId: string,
    patch: {
      displayName?: string | null;
      bio?: string | null;
      avatarPublicId?: string | null;
      avatarUrl?: string | null;
    },
    nowIso: string,
  ): Promise<UserMeRow | null> {
    return this.profile.updateProfile(userId, patch, nowIso);
  }

  async updatePreferences(
    userId: string,
    settings: Record<string, unknown>,
    nowIso: string,
  ): Promise<UserMeRow | null> {
    return this.settings.updatePreferences(userId, settings, nowIso, assembleUserMeRow);
  }

  async updatePrivacy(
    userId: string,
    flags: {
      isPublic?: boolean;
      showStatistics?: boolean;
      showAchievements?: boolean;
      showActivity?: boolean;
      showRankImprovement?: boolean;
      showTournamentActivity?: boolean;
    },
    nowIso: string,
  ): Promise<UserMeRow | null> {
    return this.settings.updatePrivacy(
      userId,
      flags,
      nowIso,
      (uid) => this.account.findMeById(uid),
      assembleUserMeRow,
    );
  }

  async updateStreakCache(
    userId: string,
    finishedAt: Date,
    tx?: DrizzleDB,
  ): Promise<StreakCacheUpdateResult | null> {
    return this.account.updateStreakCache(userId, finishedAt, tx ?? this.account.database);
  }

  async findByUsernames(usernames: string[]): Promise<UserPublicRow[]> {
    return this.account.findByUsernames(usernames);
  }

  async findByUsername(username: string): Promise<UserLookupRow | null> {
    return this.account.findByUsername(username);
  }

  async findUsersByRole(roles: ModeratorRole[]): Promise<{ userId: string }[]> {
    return this.account.findUsersByRole(roles);
  }
}
