/**
 * Activity Message Service
 *
 * Generates human-readable presentation messages from activity event facts.
 * This is the application layer logic that was previously stored in the database.
 */

import { Injectable } from '@nestjs/common';
import { ActivityEventType } from '../types/profile.types';

/**
 * Metadata structures for each event type.
 */
export interface AchievementAwardedMetadata {
  badgeId?: string;
  badgeType?: string;
  achievementType?: string;
}

export interface AttemptCompletedMetadata {
  attemptId: string;
  quizId: string;
  scorePercent: number;
  xpEarned: number;
  correctCount: number;
  totalQuestions: number;
}

export interface TournamentJoinedMetadata {
  tournamentId: string;
}

export interface TournamentCompletedMetadata {
  tournamentId: string;
  finalRank: number;
  totalParticipants: number;
}

export interface TournamentWonMetadata {
  tournamentId: string;
  prize?: string;
}

export interface RankImprovedMetadata {
  newRank: number;
  previousRank: number | null;
  period: 'weekly' | 'monthly' | 'all_time';
}

export interface RankMilestoneMetadata {
  rank: number;
  period: 'weekly' | 'monthly' | 'all_time';
}

export interface StreakMilestoneMetadata {
  streakDays: number;
  streakType: 'current' | 'longest';
  previousStreak?: number;
}

/**
 * Discriminated union of all possible metadata types.
 */
export type ActivityEventMetadata =
  | { eventType: ActivityEventType.ACHIEVEMENT_AWARDED; data: AchievementAwardedMetadata }
  | { eventType: ActivityEventType.ATTEMPT_COMPLETED; data: AttemptCompletedMetadata }
  | { eventType: ActivityEventType.TOURNAMENT_JOINED; data: TournamentJoinedMetadata }
  | { eventType: ActivityEventType.TOURNAMENT_COMPLETED; data: TournamentCompletedMetadata }
  | { eventType: ActivityEventType.TOURNAMENT_WON; data: TournamentWonMetadata }
  | { eventType: ActivityEventType.RANK_IMPROVED; data: RankImprovedMetadata }
  | { eventType: ActivityEventType.RANK_MILESTONE; data: RankMilestoneMetadata }
  | { eventType: ActivityEventType.STREAK_MILESTONE; data: StreakMilestoneMetadata };

/**
 * Generated activity message with title and description.
 */
export interface ActivityMessage {
  title: string;
  description: string | null;
}

@Injectable()
export class ActivityMessageService {
  /**
   * Generate a human-readable message from activity event facts.
   */
  generateMessage(
    eventType: ActivityEventType,
    metadata: Record<string, unknown>,
  ): ActivityMessage {
    switch (eventType) {
      case ActivityEventType.ACHIEVEMENT_AWARDED:
        return this.generateAchievementMessage();
      case ActivityEventType.ATTEMPT_COMPLETED:
        return this.generateAttemptMessage(metadata as unknown as AttemptCompletedMetadata);
      case ActivityEventType.TOURNAMENT_JOINED:
        return this.generateTournamentJoinedMessage();
      case ActivityEventType.TOURNAMENT_COMPLETED:
        return this.generateTournamentCompletedMessage(
          metadata as unknown as TournamentCompletedMetadata,
        );
      case ActivityEventType.TOURNAMENT_WON:
        return this.generateTournamentWonMessage(metadata as unknown as TournamentWonMetadata);
      case ActivityEventType.RANK_IMPROVED:
        return this.generateRankImprovedMessage(metadata as unknown as RankImprovedMetadata);
      case ActivityEventType.RANK_MILESTONE:
        return this.generateRankMilestoneMessage(metadata as unknown as RankMilestoneMetadata);
      case ActivityEventType.STREAK_MILESTONE:
        return this.generateStreakMilestoneMessage(metadata as unknown as StreakMilestoneMetadata);
      default:
        return { title: 'Activity', description: null };
    }
  }

  private generateAchievementMessage(): ActivityMessage {
    return {
      title: 'Achievement earned',
      description: null,
    };
  }

  private generateAttemptMessage(metadata: AttemptCompletedMetadata): ActivityMessage {
    return {
      title: 'Quiz attempt completed',
      description: `Score: ${metadata.scorePercent.toFixed(1)}% (${metadata.correctCount}/${metadata.totalQuestions} correct) • +${metadata.xpEarned} XP`,
    };
  }

  private generateTournamentJoinedMessage(): ActivityMessage {
    return {
      title: 'Joined tournament',
      description: null,
    };
  }

  private generateTournamentCompletedMessage(
    metadata: TournamentCompletedMetadata,
  ): ActivityMessage {
    return {
      title: 'Tournament completed',
      description: `Ranked #${metadata.finalRank} out of ${metadata.totalParticipants} participants`,
    };
  }

  private generateTournamentWonMessage(metadata: TournamentWonMetadata): ActivityMessage {
    return {
      title: 'Tournament won!',
      description: metadata.prize ? `Prize: ${metadata.prize}` : null,
    };
  }

  private generateRankImprovedMessage(metadata: RankImprovedMetadata): ActivityMessage {
    const periodLabel = metadata.period === 'all_time' ? 'global' : metadata.period;

    if (metadata.previousRank === null) {
      return {
        title: `Ranked #${metadata.newRank} (${periodLabel})`,
        description: 'New rank achieved!',
      };
    }

    const delta = metadata.previousRank - metadata.newRank;
    return {
      title: `Improved to rank #${metadata.newRank} (${periodLabel})`,
      description: `Moved up ${delta} positions`,
    };
  }

  private generateRankMilestoneMessage(metadata: RankMilestoneMetadata): ActivityMessage {
    const periodLabel =
      metadata.period === 'all_time' ? 'leaderboard' : `${metadata.period} leaderboard`;

    if (metadata.rank === 1) {
      return {
        title: '#1 on leaderboard!',
        description: `Top of the ${periodLabel}`,
      };
    }

    return {
      title: `Reached top ${metadata.rank}!`,
      description: null,
    };
  }

  private generateStreakMilestoneMessage(metadata: StreakMilestoneMetadata): ActivityMessage {
    const streakType = metadata.streakType === 'current' ? 'current streak' : 'longest streak';
    let description: string | null = null;

    if (metadata.previousStreak !== undefined && metadata.previousStreak > 0) {
      description = `Previous streak: ${metadata.previousStreak} days`;
    }

    return {
      title: `${metadata.streakDays}-day ${streakType}!`,
      description,
    };
  }
}
