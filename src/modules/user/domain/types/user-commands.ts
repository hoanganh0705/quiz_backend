export type UpdateProfileCommand = {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
};

export type UpdateSettingsCommand = {
  settings: Record<string, unknown>;
};

export type ListUserBadgesQuery = {
  limit?: number;
  cursor?: { earnedAt: string; userBadgeId: string } | null;
};

export type UserRankingSummary = {
  userId: string;
  globalRank: number | null;
  totalScore: number;
  level: number;
  updatedAt: string;
};
