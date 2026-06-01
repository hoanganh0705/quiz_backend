/**
 * Profile Query Service
 *
 * Composes the ProfileReadModel by aggregating data from multiple domains.
 * This is the primary read-side service for the User Profile domain.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  ProfileReadModel,
  StatisticsView,
  RankingView,
  AchievementView,
  ActivityView,
  FullProfileReadModel,
} from '../types/profile.types';
import { RankingQueryPort, RANKING_QUERY_PORT } from '../ports/ranking-query.port';
import { AchievementQueryPort, ACHIEVEMENT_QUERY_PORT } from '../ports/achievement-query.port';
import { AttemptQueryPort, ATTEMPT_QUERY_PORT } from '../ports/attempt-query.port';
import { TournamentQueryPort, TOURNAMENT_QUERY_PORT } from '../ports/tournament-query.port';
import { ProfileRepositoryPort, PROFILE_REPOSITORY_PORT } from '../ports/profile-repository.port';
import { ProfileSettingsRepositoryPort, PROFILE_SETTINGS_REPOSITORY_PORT } from '../ports/profile-repository.port';
import { ActivityEventRepositoryPort, ACTIVITY_EVENT_REPOSITORY_PORT } from '../ports/profile-repository.port';
import { UserQueryPort, USER_QUERY_PORT } from '../ports/user-query.port';

@Injectable()
export class ProfileQueryService {
  constructor(
    @Inject(PROFILE_REPOSITORY_PORT)
    private readonly profileRepository: ProfileRepositoryPort,
    @Inject(PROFILE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: ProfileSettingsRepositoryPort,
    @Inject(USER_QUERY_PORT)
    private readonly userQuery: UserQueryPort,
    @Inject(RANKING_QUERY_PORT)
    private readonly rankingQuery: RankingQueryPort,
    @Inject(ACHIEVEMENT_QUERY_PORT)
    private readonly achievementQuery: AchievementQueryPort,
    @Inject(ATTEMPT_QUERY_PORT)
    private readonly attemptQuery: AttemptQueryPort,
    @Inject(TOURNAMENT_QUERY_PORT)
    private readonly tournamentQuery: TournamentQueryPort,
    @Inject(ACTIVITY_EVENT_REPOSITORY_PORT)
    private readonly activityRepository: ActivityEventRepositoryPort,
    @InjectPinoLogger(ProfileQueryService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get the full profile read model for a user.
   */
  async getFullProfile(
    userId: string,
    requesterId?: string,
  ): Promise<FullProfileReadModel | null> {
    const profile = await this.profileRepository.getProfile(userId);
    const userBasic = await this.userQuery.getBasicInfo(userId);

    if (!profile || !userBasic) {
      return null;
    }

    const settings = await this.settingsRepository.getSettings(userId);

    // Check if profile is accessible
    const isOwner = requesterId === userId;
    const isPublic = settings?.isPublic ?? true;

    if (!isOwner && !isPublic) {
      return null;
    }

    // Compose all parts in parallel
    const [
      identity,
      statistics,
      ranking,
      achievements,
      activity,
    ] = await Promise.all([
      this.buildIdentity(profile, userBasic),
      this.buildStatistics(userId, settings),
      this.buildRanking(userId, settings),
      this.buildAchievements(userId, profile.pinnedBadgeIds, settings),
      this.buildActivity(userId, settings),
    ]);

    return {
      identity,
      statistics,
      ranking,
      achievements,
      activity,
    };
  }

  /**
   * Get basic profile info.
   */
  async getBasicProfile(userId: string): Promise<ProfileReadModel | null> {
    const profile = await this.profileRepository.getProfile(userId);
    const userBasic = await this.userQuery.getBasicInfo(userId);

    if (!profile || !userBasic) {
      return null;
    }

    return this.buildIdentity(profile, userBasic);
  }

  private async buildIdentity(
    profile: Awaited<ReturnType<ProfileRepositoryPort['getProfile']>>,
    userBasic: Awaited<ReturnType<UserQueryPort['getBasicInfo']>>,
  ): Promise<ProfileReadModel> {
    return {
      userId: userBasic!.userId,
      username: userBasic!.username,
      displayName: profile!.displayName ?? userBasic!.username,
      avatarUrl: profile!.avatarUrl,
      bio: profile!.bio,
      tagline: profile!.tagline,
      memberSince: userBasic!.createdAt,
      isPublic: true, // Will be overwritten by settings
    };
  }

  private async buildStatistics(
    userId: string,
    settings: Awaited<ReturnType<ProfileSettingsRepositoryPort['getSettings']>> | null,
  ): Promise<StatisticsView> {
    const showStatistics = settings?.showStatistics ?? true;

    if (!showStatistics) {
      return {
        totalXp: 0,
        totalQuizzesCompleted: 0,
        totalAttempts: 0,
        averageScore: 0,
        accuracyRate: 0,
        totalTournamentsJoined: 0,
        totalTournamentsWon: 0,
        longestStreak: 0,
      };
    }

    const [totalXp, attemptStats, tournamentStats, longestStreak] = await Promise.all([
      this.rankingQuery.getTotalXp(userId),
      this.attemptQuery.getUserStatistics(userId),
      this.tournamentQuery.getUserTournamentStats(userId),
      this.achievementQuery.getLongestStreak(userId),
    ]);

    const totalQuizzesCompleted = await this.attemptQuery.getTotalCompletedQuizzes(userId);

    return {
      totalXp,
      totalQuizzesCompleted,
      totalAttempts: attemptStats.totalAttempts,
      averageScore: attemptStats.averageScore,
      accuracyRate: attemptStats.accuracyRate,
      totalTournamentsJoined: tournamentStats.totalTournamentsJoined,
      totalTournamentsWon: tournamentStats.totalTournamentsWon,
      longestStreak,
    };
  }

  private async buildRanking(
    userId: string,
    settings: Awaited<ReturnType<ProfileSettingsRepositoryPort['getSettings']>> | null,
  ): Promise<RankingView> {
    const showStatistics = settings?.showStatistics ?? true;

    if (!showStatistics) {
      return {
        globalRank: null,
        weeklyRank: null,
        monthlyRank: null,
        peakAllTimeRank: null,
        peakWeeklyRank: null,
        peakMonthlyRank: null,
      };
    }

    return this.rankingQuery.getUserRankingView(userId);
  }

  private async buildAchievements(
    userId: string,
    pinnedBadgeIds: string[],
    settings: Awaited<ReturnType<ProfileSettingsRepositoryPort['getSettings']>> | null,
  ): Promise<AchievementView> {
    const showAchievements = settings?.showAchievements ?? true;

    if (!showAchievements) {
      return {
        totalBadges: 0,
        pinnedBadges: [],
        recentBadges: [],
      };
    }

    const [allBadges, recentBadges, badgeCount] = await Promise.all([
      this.achievementQuery.getUserBadges(userId),
      this.achievementQuery.getRecentBadges(userId, 5),
      this.achievementQuery.getBadgeCount(userId),
    ]);

    // Filter pinned badges
    const pinnedBadges = pinnedBadgeIds
      .map(id => allBadges.find(b => b.badgeId === id))
      .filter((b): b is NonNullable<typeof b> => b !== undefined);

    return {
      totalBadges: badgeCount,
      pinnedBadges,
      recentBadges,
    };
  }

  private async buildActivity(
    userId: string,
    settings: Awaited<ReturnType<ProfileSettingsRepositoryPort['getSettings']>> | null,
  ): Promise<ActivityView> {
    const showActivity = settings?.showActivity ?? true;

    if (!showActivity) {
      return {
        recentAttempts: [],
        recentTournaments: [],
        timeline: [],
      };
    }

    const showTournamentActivity = settings?.showTournamentActivity ?? true;

    const [timeline, recentAttempts, recentTournaments] = await Promise.all([
      this.activityRepository.getTimeline(userId, { limit: 20 }),
      this.attemptQuery.getRecentAttempts(userId, 5),
      showTournamentActivity
        ? this.tournamentQuery.getRecentTournaments(userId, 5)
        : Promise.resolve([]),
    ]);

    return {
      recentAttempts,
      recentTournaments,
      timeline: timeline.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        metadata: event.metadata,
        occurredAt: event.occurredAt,
      })),
    };
  }
}
