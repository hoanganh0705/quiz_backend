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
  settings: Record<string, unknown>;
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

export interface UserActivityRow {
  eventId: string;
  eventType: string;
  createdAt: string;
  metadata: unknown;
}

export interface MyTournamentRow {
  participantId: string;
  tournamentId: string;
  name: string;
  status: TournamentStatus;
  registeredAt: string;
  startAt: string;
  endAt: string;
}

export interface MyTournamentHistoryRow {
  participantId: string;
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
  findUserProfileSettings(userId: string): Promise<{ isPublic: boolean } | null>;
  listUserBadges(params: {
    userId: string;
    limit: number;
    cursor?: { earnedAt: string; userBadgeId: string } | null;
  }): Promise<UserBadgeRow[]>;
  getUserRanking(userId: string): Promise<UserRankingRow | null>;
  getUserAnalytics(userId: string): Promise<UserAnalytics | null>;
  listUserActivity(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; eventId: string } | null;
  }): Promise<UserActivityRow[]>;
  listMyTournaments(params: {
    userId: string;
    limit: number;
    cursor?: { registeredAt: string; participantId: string } | null;
  }): Promise<{ items: MyTournamentRow[]; hasNextPage: boolean }>;
  listMyTournamentHistory(params: {
    userId: string;
    limit: number;
    cursor?: { completedAt: string; participantId: string } | null;
  }): Promise<{ items: MyTournamentHistoryRow[]; hasNextPage: boolean }>;
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
