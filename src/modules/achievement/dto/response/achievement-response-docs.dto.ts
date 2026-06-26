import { ApiProperty } from '@nestjs/swagger';

// ─── Achievement module documentation-only wrapper DTOs ───────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp: string } }
//
// Runtime DTO classes (BadgeCatalogItemResponseDto, MyBadgesResponseDto, etc.)
// remain unchanged. These wrapper DTOs are used ONLY in @ApiOkResponse /
// @ApiCreatedResponse decorators to document the actual wrapped shape in the
// OpenAPI spec. They mirror the auth and quiz module conventions.
//
// Runtime shape key mapping for this module:
//   - getBadgeCatalog → { data: { data: BadgeCatalogItemDto[], total }, meta }
//   - getMyBadges → { data: { data: MyBadgeItemDto[], total }, meta }
//   - getBadgeDetails → { data: BadgeDetailsResponseDto, meta }
//   - revokeUserBadge → 204 No Content (no body)
//   - getPublicAchievementProfile → { data: PublicAchievementProfileResponseDto, meta }
//   - getMyBadgeProgress → { data: BadgeProgressResponseDto, meta }
//   - getMyAchievementHistory → { data: { data: AchievementHistoryItemDto[], total }, meta }
//   - getMyBadgeAnalytics → { data: UserBadgeAnalyticsResponseDto, meta }
//   - reevaluateUser → { data: ReevaluateUserResponseDto, meta }
//   - getUserHistory → { data: { data: AchievementHistoryItemDto[], total }, meta }
//     (admin variant returns the same payload shape as getMyAchievementHistory)
//
// ─── Nested data types (re-exported payload shape) ────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class BadgeCatalogItemNestedDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_10' })
  id!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 10' })
  name!: string;

  @ApiProperty({
    description: 'Badge description',
    example: 'Reach Top 10 ranking',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ description: 'Badge rarity', example: 'epic' })
  rarity!: string;

  @ApiProperty({ description: 'Number of users who earned this badge', example: 1243 })
  earnedCount!: number;
}

class BadgeCatalogListDataDto {
  @ApiProperty({
    description: 'Badge catalog items',
    type: [BadgeCatalogItemNestedDto],
  })
  data!: BadgeCatalogItemNestedDto[];

  @ApiProperty({ description: 'Total count of badges matching the query', example: 25 })
  total!: number;
}

class MyBadgeItemNestedDto {
  @ApiProperty({ description: 'Unique badge identifier' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge display name' })
  name!: string;

  @ApiProperty({ nullable: true, description: 'Badge description' })
  description!: string | null;

  @ApiProperty({ description: 'Badge rarity tier' })
  rarity!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp when the user earned this badge' })
  earnedAt!: string;
}

class MyBadgesListDataDto {
  @ApiProperty({
    description: 'List of badges earned by the authenticated user',
    type: [MyBadgeItemNestedDto],
  })
  data!: MyBadgeItemNestedDto[];

  @ApiProperty({ description: 'Total count of badges matching the query', example: 25 })
  total!: number;
}

class BadgeDetailsDataDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_10' })
  id!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 10' })
  name!: string;

  @ApiProperty({
    description: 'Badge description',
    nullable: true,
    example: 'Reach Top 10 ranking',
  })
  description!: string | null;

  @ApiProperty({ description: 'Badge rarity', example: 'epic' })
  rarity!: string;

  @ApiProperty({ description: 'Total number of users who earned this badge', example: 1243 })
  earnedCount!: number;
}

class BadgeProgressDataDto {
  @ApiProperty({ description: 'Badge identifier', example: 'streak_100' })
  badgeId!: string;

  @ApiProperty({ description: 'Current user progress value', example: 56 })
  current!: number;

  @ApiProperty({ description: 'Target value required to earn the badge', example: 100 })
  target!: number;

  @ApiProperty({ description: 'Progress percentage clamped between 0 and 100', example: 56 })
  percent!: number;
}

class FeaturedBadgeNestedDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_10' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 10' })
  badgeName!: string;

  @ApiProperty({ description: 'Badge rarity', example: 'epic' })
  rarity!: string;
}

class PublicAchievementProfileDataDto {
  @ApiProperty({ description: 'User identifier', example: 'xxx' })
  userId!: string;

  @ApiProperty({ description: 'Total earned badges', example: 25 })
  totalBadges!: number;

  @ApiProperty({ description: 'Number of rare badges earned', example: 3 })
  rareBadges!: number;

  @ApiProperty({
    description: 'Best public rank achieved by the user',
    example: 12,
    nullable: true,
  })
  highestRank!: number | null;

  @ApiProperty({
    description: 'Featured badges prioritized by rarity',
    type: [FeaturedBadgeNestedDto],
  })
  featuredBadges!: FeaturedBadgeNestedDto[];
}

class UserBadgeAnalyticsDataDto {
  @ApiProperty({ description: 'Total earned badges for the authenticated user', example: 15 })
  totalBadges!: number;

  @ApiProperty({ description: 'Number of rare-or-better badges earned', example: 2 })
  rareBadges!: number;

  @ApiProperty({ description: 'Completion rate percentage clamped between 0 and 100', example: 32 })
  completionRate!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the most recently earned badge',
    nullable: true,
    example: '2026-06-01T10:00:00Z',
  })
  latestBadgeEarnedAt!: string | null;
}

class AchievementHistoryItemNestedDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_100' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 100' })
  badgeName!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the badge was earned',
    example: '2026-06-01T10:00:00Z',
  })
  earnedAt!: string;
}

class AchievementHistoryListDataDto {
  @ApiProperty({
    description: 'Achievement history items',
    type: [AchievementHistoryItemNestedDto],
  })
  data!: AchievementHistoryItemNestedDto[];

  @ApiProperty({ description: 'Total count of history entries', example: 25 })
  total!: number;
}

class ReevaluateUserDataDto {
  @ApiProperty({ description: 'Human-readable outcome message' })
  message!: string;

  @ApiProperty({ description: 'Number of badges checked during reevaluation' })
  checked!: number;

  @ApiProperty({ description: 'Number of badges awarded during reevaluation' })
  awarded!: number;

  @ApiProperty({ description: 'Number of errors encountered during reevaluation' })
  errors!: number;
}

class AdminHistoryItemDto {
  @ApiProperty({ description: 'Unique user-badge ownership identifier' })
  userBadgeId!: string;

  @ApiProperty({ description: 'User identifier' })
  userId!: string;

  @ApiProperty({ description: 'Badge identifier' })
  badgeId!: string;

  @ApiProperty({ description: 'URL-friendly badge slug' })
  badgeSlug!: string;

  @ApiProperty({ description: 'Badge display name' })
  badgeName!: string;

  @ApiProperty({ description: 'Badge type' })
  badgeType!: string;

  @ApiProperty({ description: 'Badge category' })
  badgeCategory!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp when the badge was earned' })
  earnedAt!: string;

  @ApiProperty({ description: 'Badge version at the time of award' })
  badgeVersion!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the badge expires',
    nullable: true,
  })
  expiresAt!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the badge was revoked',
    nullable: true,
  })
  revokedAt!: string | null;

  @ApiProperty({
    description: 'Reason for revocation',
    type: String,
    nullable: true,
  })
  revocationReason!: string | null;

  @ApiProperty({ description: 'Additional badge metadata', type: Object })
  metadata!: Record<string, unknown>;

  @ApiProperty({ description: 'Whether the badge is currently active' })
  isActive!: boolean;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

/**
 * Runtime shape: { data: { data: BadgeCatalogItemDto[], total }, meta: { timestamp } }
 * Used for: GET /achievements/badges
 */
export class WrappedBadgeCatalogResponseDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => BadgeCatalogListDataDto })
  data!: BadgeCatalogListDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { data: MyBadgeItemDto[], total }, meta: { timestamp } }
 * Used for: GET /achievements/me/badges
 */
export class WrappedMyBadgesResponseDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => MyBadgesListDataDto })
  data!: MyBadgesListDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: BadgeDetailsResponseDto, meta: { timestamp } }
 * Used for: GET /achievements/badges/:badgeId
 */
export class WrappedBadgeDetailsResponseDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => BadgeDetailsDataDto })
  data!: BadgeDetailsDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: PublicAchievementProfileResponseDto, meta: { timestamp } }
 * Used for: GET /achievements/users/:userId/achievements
 */
export class WrappedPublicAchievementProfileResponseDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => PublicAchievementProfileDataDto,
  })
  data!: PublicAchievementProfileDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: BadgeProgressResponseDto, meta: { timestamp } }
 * Used for: GET /achievements/users/me/badges/:badgeId/progress
 */
export class WrappedBadgeProgressResponseDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => BadgeProgressDataDto })
  data!: BadgeProgressDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: { data: AchievementHistoryItemDto[], total }, meta: { timestamp } }
 * Used for: GET /achievements/users/me/achievements/history
 *          GET /admin/achievements/reevaluate/:userId/history
 */
export class WrappedAchievementHistoryResponseDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => AchievementHistoryListDataDto,
  })
  data!: AchievementHistoryListDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: UserBadgeAnalyticsResponseDto, meta: { timestamp } }
 * Used for: GET /achievements/users/me/badges/analytics
 */
export class WrappedUserBadgeAnalyticsResponseDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: () => UserBadgeAnalyticsDataDto,
  })
  data!: UserBadgeAnalyticsDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: ReevaluateUserResponseDto, meta: { timestamp } }
 * Used for: POST /admin/achievements/reevaluate/:userId
 */
export class WrappedReevaluateUserResponseDto {
  @ApiProperty({ description: 'Wrapped response payload', type: () => ReevaluateUserDataDto })
  data!: ReevaluateUserDataDto;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: AdminHistoryItemDto[], meta: { timestamp } }
 * Used for: GET /admin/achievements/reevaluate/:userId/history
 */
export class WrappedAdminHistoryListDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    isArray: true,
    type: () => AdminHistoryItemDto,
  })
  data!: AdminHistoryItemDto[];

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}

/**
 * Runtime shape: { data: null, meta: { timestamp } }
 * The controller returns Promise<void>; ResponseFormatInterceptor wraps
 * the implicit `null` body as the standard envelope.
 * Used for: DELETE /achievements/users/:userId/badges/:badgeId
 */
export class WrappedRevokeBadgeResponseDto {
  @ApiProperty({
    description: 'Always null for void controller returns wrapped by the response interceptor',
    type: () => Object,
    nullable: true,
    example: null,
  })
  data!: Record<string, never> | null;

  @ApiProperty({ description: 'Response metadata', type: () => MetaDto })
  meta!: MetaDto;
}
