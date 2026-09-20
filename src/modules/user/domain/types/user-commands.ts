import type { UserPrivacySettingsDto } from '../../dto/request/update-me-settings.dto';

export type UpdateProfileCommand = {
  displayName?: string | null;
  bio?: string | null;
  avatarPublicId?: string | null;
  avatarUrl?: string | null;
};

export type UpdateSettingsCommand = {
  preferences?: Record<string, unknown>;
  privacy?: UserPrivacySettingsDto;
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
