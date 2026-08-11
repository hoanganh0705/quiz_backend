import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 3 (S-21): rename `occurredAt` to `at` to align with the
 * frontend's closed-union activity contract. The alias is
 * intentional: a future wire bump replaces the old field with
 * the new one in a single move. For Phase 3 we accept the
 * backward-incompatible rename across this contract because
 * the activity items are private to the activity stream surface.
 */
export class SocialFeedUserDto {
  @ApiProperty({
    description: 'User identifier for the activity actor',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username for the activity actor', example: 'anh_dev' })
  username!: string;
}

/**
 * Phase 3 (S-22): shared slim-actor projection embedded on
 * `SocialFeedItemDto.actor` and `UserActivityItemDto.actor`.
 * Mirrors the `AuthorSummaryDto` shape but is duplicated here
 * to keep the social module self-contained — the social feed
 * does not import the quiz module to remain transport-only.
 */
export class PublicAuthorSummaryDto {
  @ApiProperty({
    description: 'Actor user identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Actor username', example: 'anh_dev' })
  username!: string;

  @ApiProperty({ description: 'Actor display name', example: 'Anh', nullable: true })
  displayName!: string | null;

  @ApiProperty({
    description: 'Actor avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/anh.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}
import { CursorPagination } from '@/common/responses/pagination';
import type { SocialFeedActivityType } from '../../domain/types/social.types';

/**
 * Canonical list of valid feed activity types.
 * Sourced from SocialFeedActivityType in social.types.ts to prevent drift.
 */
const SOCIAL_FEED_ACTIVITY_TYPES: readonly SocialFeedActivityType[] = [
  'badge_earned',
  'badge_revoked',
  'rank_milestone',
  'peak_rank_achieved',
  'tournament_joined',
  'tournament_completed',
  'tournament_won',
  'comment_created',
  'quiz_completed',
  'quiz_milestone',
  'instance_created',
  'instance_joined',
  'instance_completed',
] as const;

/**
 * Phase 3 (S-21): rename `occurredAt` to `at` to align with the
 * frontend's closed-union activity contract. The wire bump is
 * intentionally atomic across this module's responses.
 */
export class SocialFeedItemDto {
  @ApiProperty({
    description: 'Feed activity identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Feed activity type',
    enum: SOCIAL_FEED_ACTIVITY_TYPES,
    example: 'badge_earned',
  })
  type!: SocialFeedActivityType;

  @ApiProperty({
    description:
      'Timestamp when the activity occurred (ISO 8601). Renamed from `occurredAt` to `at` in Phase 3 (S-21).',
    example: '2026-06-09T10:00:00.000Z',
  })
  at!: string;

  @ApiProperty({ description: 'Actor who produced the activity', type: () => SocialFeedUserDto })
  user!: SocialFeedUserDto;

  /**
   * Phase 3 (S-22): slim-actor projection. Same shape as
   * `PublicAuthorSummaryDto`. The frontend prefers `actor` over
   * `user` to align with the union closed-union contract.
   */
  @ApiProperty({
    description: 'Actor slim projection',
    type: () => PublicAuthorSummaryDto,
    nullable: true,
  })
  actor!: PublicAuthorSummaryDto | null;

  @ApiProperty({
    description: 'Type-specific activity payload — discriminated by `type`',
    example: { badgeId: 'top_10', badgeName: 'Top 10' },
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;
}

export class SocialFeedResponseDto {
  @ApiProperty({ description: 'Feed items', type: () => [SocialFeedItemDto] })
  items!: SocialFeedItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}

export class UserActivityItemDto {
  @ApiProperty({
    description: 'Activity identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'User activity type',
    enum: SOCIAL_FEED_ACTIVITY_TYPES,
    example: 'badge_earned',
  })
  type!: SocialFeedActivityType;

  @ApiProperty({
    description:
      'Timestamp when the activity occurred (ISO 8601). Renamed from `occurredAt` to `at` in Phase 3 (S-21).',
    example: '2026-06-08T12:00:00.000Z',
  })
  at!: string;

  /**
   * Phase 3 (S-22): slim-actor projection for the user-activity stream.
   */
  @ApiProperty({
    description: 'Actor slim projection',
    type: () => PublicAuthorSummaryDto,
    nullable: true,
  })
  actor!: PublicAuthorSummaryDto | null;

  @ApiProperty({
    description: 'Type-specific public activity payload — discriminated by `type`',
    example: { badgeName: 'Top 100' },
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;
}

export class UserActivityResponseDto {
  @ApiProperty({ description: 'User activity items', type: () => [UserActivityItemDto] })
  items!: UserActivityItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}
