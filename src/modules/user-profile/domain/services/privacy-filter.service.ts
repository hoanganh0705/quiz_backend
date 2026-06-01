/**
 * Privacy Filter Utility
 *
 * Applies privacy rules to profile data based on settings and requester identity.
 */

import type {
  ProfileSettingsRow,
  StatisticsView,
  RankingView,
  AchievementView,
  ActivityView,
} from '../types/profile.types';

export interface PrivacyContext {
  requesterId?: string;
  isOwner: boolean;
  isPublic: boolean;
}

export interface FilteredProfileSections {
  statistics: StatisticsView | null;
  ranking: RankingView | null;
  achievements: AchievementView | null;
  activity: ActivityView | null;
}

/**
 * Privacy filter that applies visibility rules to profile sections.
 */
export class PrivacyFilter {
  /**
   * Determine if a profile is accessible to a requester.
   */
  static canAccessProfile(context: PrivacyContext): boolean {
    if (context.isOwner) {
      return true;
    }
    return context.isPublic;
  }

  /**
   * Get all privacy settings for a user.
   */
  static getSettingsVisibility(settings: ProfileSettingsRow | null): {
    showStatistics: boolean;
    showAchievements: boolean;
    showActivity: boolean;
    showRankImprovement: boolean;
    showTournamentActivity: boolean;
  } {
    return {
      showStatistics: settings?.showStatistics ?? true,
      showAchievements: settings?.showAchievements ?? true,
      showActivity: settings?.showActivity ?? true,
      showRankImprovement: settings?.showRankImprovement ?? true,
      showTournamentActivity: settings?.showTournamentActivity ?? true,
    };
  }

  /**
   * Apply privacy rules to profile sections.
   */
  static filterProfileSections(
    settings: ProfileSettingsRow | null,
    sections: {
      statistics: StatisticsView | null;
      ranking: RankingView | null;
      achievements: AchievementView | null;
      activity: ActivityView | null;
    },
    context: PrivacyContext,
  ): FilteredProfileSections {
    const visibility = this.getSettingsVisibility(settings);

    if (!this.canAccessProfile(context)) {
      return {
        statistics: null,
        ranking: null,
        achievements: null,
        activity: null,
      };
    }

    return {
      statistics: visibility.showStatistics ? sections.statistics : this.getEmptyStatistics(),
      ranking: visibility.showStatistics ? sections.ranking : this.getEmptyRanking(),
      achievements: visibility.showAchievements
        ? sections.achievements
        : this.getEmptyAchievements(),
      activity: visibility.showActivity
        ? this.filterActivity(sections.activity, context)
        : this.getEmptyActivity(),
    };
  }

  /**
   * Filter activity timeline based on privacy settings.
   */
  static filterActivity(activity: ActivityView | null, context: PrivacyContext): ActivityView {
    if (!activity) {
      return this.getEmptyActivity();
    }

    return {
      recentAttempts: activity.recentAttempts,
      recentTournaments:
        context.isOwner || activity.recentTournaments ? activity.recentTournaments : [],
      timeline: activity.timeline.filter((event) => {
        if (event.metadata?.visibility === 'private' && !context.isOwner) {
          return false;
        }
        return true;
      }),
    };
  }

  /**
   * Filter statistics for privacy.
   */
  static filterStatistics(
    statistics: StatisticsView | null,
    showRankImprovement: boolean,
    showTournamentActivity: boolean,
  ): StatisticsView {
    if (!statistics) {
      return this.getEmptyStatistics();
    }

    return {
      ...statistics,
      totalTournamentsJoined: showTournamentActivity ? statistics.totalTournamentsJoined : 0,
      totalTournamentsWon: showTournamentActivity ? statistics.totalTournamentsWon : 0,
    };
  }

  /**
   * Filter ranking data for privacy.
   */
  static filterRanking(ranking: RankingView | null, showRankImprovement: boolean): RankingView {
    if (!ranking) {
      return this.getEmptyRanking();
    }

    return {
      ...ranking,
      peakAllTimeRank: showRankImprovement ? ranking.peakAllTimeRank : null,
      peakWeeklyRank: showRankImprovement ? ranking.peakWeeklyRank : null,
      peakMonthlyRank: showRankImprovement ? ranking.peakMonthlyRank : null,
    };
  }

  /**
   * Create empty statistics object.
   */
  private static getEmptyStatistics(): StatisticsView {
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

  /**
   * Create empty ranking object.
   */
  private static getEmptyRanking(): RankingView {
    return {
      globalRank: null,
      weeklyRank: null,
      monthlyRank: null,
      peakAllTimeRank: null,
      peakWeeklyRank: null,
      peakMonthlyRank: null,
    };
  }

  /**
   * Create empty achievements object.
   */
  private static getEmptyAchievements(): AchievementView {
    return {
      totalBadges: 0,
      pinnedBadges: [],
      recentBadges: [],
    };
  }

  /**
   * Create empty activity object.
   */
  private static getEmptyActivity(): ActivityView {
    return {
      recentAttempts: [],
      recentTournaments: [],
      timeline: [],
    };
  }
}
