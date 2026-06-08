import type { UserAnalytics } from '../types/user-analytics';
import type { TournamentStatus } from '@/modules/tournament/types/tournament.types';

export interface UserMeRow {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UserBadgeRow {
  userBadgeId: string;
  badgeId: string;
  name: string;
  description: string | null;
  earnedAt: string;
}

export interface UserRankingRow {
  userId: string;
  globalRank: number | null;
  totalScore: number;
  updatedAt: string;
}

export interface UserSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserActivityRow {
  eventId: string;
  eventType: string;
  createdAt: string;
  metadata: unknown;
}

export interface MyTournamentRow {
  tournamentId: string;
  name: string;
  status: TournamentStatus;
  registeredAt: string;
  startAt: string;
  endAt: string;
}

export interface MyTournamentHistoryRow {
  tournamentId: string;
  tournamentName: string;
  finalRank: number | null;
  finalScore: number;
  participantCount: number;
  completedAt: string;
}

export interface PublicTournamentProfileRow {
  userId: string;
  tournamentsPlayed: number;
  tournamentsWon: number;
  bestRank: number | null;
  averageRank: number | null;
  top10Finishes: number;
  totalTournamentScore: number;
  lastTournamentAt: string | null;
}

export interface MyTournamentAnalyticsRow {
  tournamentsPlayed: number;
  wins: number;
  top3Finishes: number;
  top10Finishes: number;
  averageRank: number | null;
  bestRank: number | null;
  averageScore: number;
  totalTournamentScore: number;
  completionRate: number;
  lastTournamentAt: string | null;
}

export interface UserRepositoryPort {
  findMeById(userId: string): Promise<UserMeRow | null>;
  listUserBadges(params: {
    userId: string;
    limit: number;
    cursor?: { earnedAt: string; userBadgeId: string } | null;
  }): Promise<UserBadgeRow[]>;
  getUserRanking(userId: string): Promise<UserRankingRow | null>;
  getUserAnalytics(userId: string): Promise<UserAnalytics | null>;
  searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]>;
  listUserActivity(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; eventId: string } | null;
  }): Promise<UserActivityRow[]>;
  listMyTournaments(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MyTournamentRow[]; total: number }>;
  listMyTournamentHistory(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MyTournamentHistoryRow[]; total: number }>;
  getPublicTournamentProfile(userId: string): Promise<PublicTournamentProfileRow>;
  getMyTournamentAnalytics(userId: string): Promise<MyTournamentAnalyticsRow>;
  updateProfile(
    userId: string,
    patch: {
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    },
    nowIso: string,
  ): Promise<UserMeRow | null>;
  updateSettings(
    userId: string,
    settings: Record<string, unknown>,
    nowIso: string,
  ): Promise<UserMeRow | null>;
}

export const USER_REPOSITORY_PORT = Symbol('USER_REPOSITORY_PORT');
