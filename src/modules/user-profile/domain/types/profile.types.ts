/**
 * User Profile Domain Types
 */

// ============================================
// ENUMS
// ============================================

export enum ProfileVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum ActivityEventType {
  ATTEMPT_COMPLETED = 'attempt_completed',
  ACHIEVEMENT_AWARDED = 'achievement_awarded',
  TOURNAMENT_JOINED = 'tournament_joined',
  TOURNAMENT_COMPLETED = 'tournament_completed',
  TOURNAMENT_WON = 'tournament_won',
  RANK_IMPROVED = 'rank_improved',
  RANK_MILESTONE = 'rank_milestone',
  STREAK_MILESTONE = 'streak_milestone',
}

// ============================================
// PROFILE TYPES
// ============================================

export interface ProfileRow {
  profileId: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  tagline: string | null;
  pinnedBadgeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSettingsRow {
  settingsId: string;
  userId: string;
  isPublic: boolean;
  showStatistics: boolean;
  showAchievements: boolean;
  showActivity: boolean;
  showRankImprovement: boolean;
  showTournamentActivity: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEventRow {
  eventId: string;
  userId: string;
  eventType: ActivityEventType;
  metadata: Record<string, unknown>;
  visibility: 'public' | 'private';
  occurredAt: string;
  createdAt: string;
}

// ============================================
// READ MODEL TYPES
// ============================================

export interface ProfileReadModel {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  tagline: string | null;
  memberSince: string;
  isPublic: boolean;
}

export interface StatisticsView {
  totalXp: number;
  totalQuizzesCompleted: number;
  totalAttempts: number;
  averageScore: number;
  accuracyRate: number;
  totalTournamentsJoined: number;
  totalTournamentsWon: number;
  longestStreak: number;
}

export interface RankInfo {
  rank: number | null;
  xp: number;
  totalParticipants: number;
  percentile: number;
  percentileLabel: string;
  xpToNextRank: number | null;
}

export interface RankingView {
  globalRank: RankInfo | null;
  weeklyRank: RankInfo | null;
  monthlyRank: RankInfo | null;
  peakAllTimeRank: number | null;
  peakWeeklyRank: number | null;
  peakMonthlyRank: number | null;
}

export interface BadgeView {
  badgeId: string;
  badgeType: string;
  name: string;
  description: string;
  iconUrl: string | null;
  awardedAt: string;
}

export interface AchievementView {
  totalBadges: number;
  pinnedBadges: BadgeView[];
  recentBadges: BadgeView[];
}

export interface ActivityEventView {
  eventId: string;
  eventType: ActivityEventType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface ActivityView {
  recentAttempts: AttemptSummary[];
  recentTournaments: TournamentSummary[];
  timeline: ActivityEventView[];
}

export interface AttemptSummary {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  scorePercent: number;
  completedAt: string;
}

export interface TournamentSummary {
  tournamentId: string;
  tournamentTitle: string;
  rankFinal: number | null;
  status: string;
  completedAt: string | null;
}

export interface FullProfileReadModel {
  identity: ProfileReadModel;
  statistics: StatisticsView;
  ranking: RankingView;
  achievements: AchievementView;
  activity: ActivityView;
}
