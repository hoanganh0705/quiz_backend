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

export interface UserRepositoryPort {
  findMeById(userId: string): Promise<UserMeRow | null>;
  searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]>;
  listUserActivity(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; eventId: string } | null;
  }): Promise<UserActivityRow[]>;
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
