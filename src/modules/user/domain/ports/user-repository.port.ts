import type { UserAnalytics } from '../types/user-analytics';

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
