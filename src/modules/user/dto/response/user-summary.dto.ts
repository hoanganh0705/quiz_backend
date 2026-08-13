import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LevelTitle } from '../../domain/types/level.types';

/**
 * Phase 1 (S-2 + S-3 + S-5): composite "what to show on my profile page"
 * projection returned by `GET /users/me/summary`.
 *
 * The route is the canonical target for every profile UI that needs
 * more than the slim identity payload on `/users/me`. The fields are
 * stable; downstream pages (`/profile/[name]`, the public profile
 * fallback in Phase 3, and the dashboard) read from this shape so
 * adding a new field should be additive — only opt for a new endpoint
 * when the field is genuinely uncorrelated (e.g. social feed).
 *
 * Composition map (kept here so reviewers can audit the boundary):
 *   - identity         ← `users` + `user_profiles`
 *   - level projection ← `user_ranking.all_time_xp` (LevelService)
 *   - streak           ← `users.current_streak` / `users.longest_streak`
 *   - counts           ← `social.counts` (followers/following/friends)
 *   - creator counts   ← `CreatorQuizAnalyticsDto` (quizzes created/published)
 *   - taken count      ← `UserAnalyticsDto.summary.completedQuizzes`
 */
export class UserSummaryResponseDto {
  // ─── Identity ─────────────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Opaque user identifier (UUIDv7)',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'URL-friendly handle', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    example: 'Alice',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiPropertyOptional({
    description: 'Profile bio',
    type: String,
    example: 'Quiz enthusiast',
    nullable: true,
  })
  bio!: string | null;

  @ApiPropertyOptional({
    description: 'Country display name',
    type: String,
    example: 'Vietnam',
    nullable: true,
  })
  country!: string | null;

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 country code',
    type: String,
    example: 'VN',
    nullable: true,
  })
  countryCode!: string | null;

  @ApiPropertyOptional({
    description: 'Profile background image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/bg/alice.jpg',
    nullable: true,
  })
  bgImageUrl!: string | null;

  @ApiProperty({
    description: 'Account creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last write to any user row (ISO 8601)',
    example: '2026-07-20T12:00:00.000Z',
  })
  updatedAt!: string;

  // ─── Level progression ────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Total experience points. 0 means no ranking row yet.',
    example: 15420,
  })
  xpTotal!: number;

  @ApiProperty({ description: 'Current 1-indexed level', example: 31 })
  level!: number;

  @ApiProperty({
    description: 'XP required to enter the current level (lower bound)',
    example: 15000,
  })
  currentLevelXP!: number;

  @ApiProperty({
    description: 'XP required to enter the next level (exclusive ceiling)',
    example: 15500,
  })
  nextLevelXP!: number;

  @ApiProperty({
    description: 'Progress through the current level, clamped to `[0, 99.9]`',
    example: 84.0,
  })
  xpProgressPercent!: number;

  @ApiProperty({
    description: 'Qualitative band for the user’s current level',
    enum: LevelTitle,
    enumName: 'LevelTitle',
    example: LevelTitle.Specialist,
  })
  levelTitle!: LevelTitle;

  /**
   * Phase 6: locale-aware human-readable title for `levelTitle`.
   * The `Accept-Language` request header negotiates between
   * the supported locales (`en`, `vi`); unknown languages fall
   * back to `en`. The field is the label the UI renders next to
   * the level chip; `levelTitle` remains the machine-readable
   * enum for branching logic.
   */
  @ApiProperty({
    description:
      'Locale-aware label for `levelTitle`. Negotiated from the `Accept-Language` header; falls back to `en`.',
    example: 'Specialist',
  })
  levelTitleLocalised!: string;

  // ─── Streaks ──────────────────────────────────────────────────────────────

  @ApiProperty({ description: 'Current daily quiz streak', example: 7 })
  currentStreak!: number;

  @ApiProperty({ description: 'Longest daily quiz streak ever', example: 14 })
  longestStreak!: number;

  // ─── Activity counts ──────────────────────────────────────────────────────

  @ApiProperty({ description: 'Number of quizzes the user has authored', example: 12 })
  quizzesCreated!: number;

  @ApiProperty({
    description: 'Number of authored quizzes that are currently published',
    example: 9,
  })
  quizzesPublished!: number;

  @ApiProperty({
    description: 'Number of unique quizzes the user has completed',
    example: 84,
  })
  quizzesTaken!: number;

  // ─── Social counts ────────────────────────────────────────────────────────

  @ApiProperty({ description: 'Number of accounts following this user', example: 450 })
  followers!: number;

  @ApiProperty({ description: 'Number of accounts this user follows', example: 78 })
  following!: number;

  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  friends!: number;

  // ─── Coin economy ────────────────────────────────────────────────────────

  /**
   * Phase 3 (S-coin): cached coin balance. The header pill on the
   * profile page reads from this single field; an uncached user
   * returns 0. The full ledger is at `GET /me/coin-transactions`.
   */
  @ApiProperty({
    description:
      'Cached coin balance from `user_wallets.balance`. 0 when the user has never been credited.',
    example: 487,
  })
  coinBalance!: number;
}
