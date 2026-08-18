import type { UserPrivacySettingsDto } from '../../dto/request/update-me-settings.dto';

export type UpdateProfileCommand = {
  displayName?: string | null;
  bio?: string | null;
  /**
   * Phase 6: Cloudinary `public_id` for the avatar. The application
   * service enforces the §11 ownership rule before this command is
   * dispatched.
   */
  avatarPublicId?: string | null;
  /**
   * @deprecated Phase 6 — superseded by `avatarPublicId`. Kept for
   * admin / migration callers.
   */
  avatarUrl?: string | null;
};

/**
 * Phase 3 (F-6): Split the previous single-field `settings` blob into
 * two independent sub-commands. Both are optional; the application layer
 * guarantees that at least one is present before the command is sent
 * to the domain.
 *
 *   - `preferences` is written to `users.settings` (the existing JSONB
 *     blob, retained for free-form client preferences).
 *   - `privacy` is written to `user_profile_settings` (the granular
 *     visibility flags). Each flag omitted leaves the stored value
 *     alone; a flag explicitly set overrides the stored value.
 */
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
