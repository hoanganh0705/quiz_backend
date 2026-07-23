import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';

const SOCIAL_FEED_ACTIVITY_TYPES = [
  'badge_earned',
  'badge_revoked',
  'rank_milestone',
  'peak_rank_achieved',
  'tournament_joined',
  'tournament_completed',
  'tournament_won',
  'comment_created',
  'discussion_created',
  'discussion_solved',
  'quiz_completed',
  'quiz_milestone',
  'instance_created',
  'instance_joined',
  'instance_completed',
] as const;

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
  type!: (typeof SOCIAL_FEED_ACTIVITY_TYPES)[number];

  @ApiProperty({
    description: 'Timestamp when the activity occurred (ISO 8601)',
    example: '2026-06-09T10:00:00.000Z',
  })
  occurredAt!: string;

  @ApiProperty({ description: 'Actor who produced the activity', type: () => SocialFeedUserDto })
  user!: SocialFeedUserDto;

  @ApiProperty({
    description: 'Type-specific activity payload',
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
  type!: (typeof SOCIAL_FEED_ACTIVITY_TYPES)[number];

  @ApiProperty({
    description: 'Timestamp when the activity occurred (ISO 8601)',
    example: '2026-06-08T12:00:00.000Z',
  })
  occurredAt!: string;

  @ApiProperty({
    description: 'Type-specific public activity payload',
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
