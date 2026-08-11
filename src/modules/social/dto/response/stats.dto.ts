import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 3 (S-17): the `staleAt` / `isStale` pair on every social
 * eventually-consistent projection. `staleAt` is the timestamp at
 * which the cache entry is considered stale; `isStale` is the
 * derived truthy flag for consumers that want a boolean shortcut.
 */

export class SocialCountsDto {
  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  friendCount!: number;

  @ApiProperty({ description: 'Number of followers', example: 34 })
  followerCount!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 28 })
  followingCount!: number;
}

export class UserSocialStatsResponseDto {
  @ApiProperty({ description: 'Number of accepted friendships', example: 120 })
  friends!: number;

  @ApiProperty({ description: 'Number of followers', example: 450 })
  followers!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 78 })
  following!: number;

  @ApiPropertyOptional({
    description:
      'Phase 3 (S-17): timestamp at which the cached snapshot is considered stale (ISO 8601). Null when fresh.',
    example: '2026-08-10T13:30:00.000Z',
    nullable: true,
  })
  staleAt!: string | null;

  @ApiProperty({
    description: 'Phase 3 (S-17): whether the snapshot is stale (`staleAt` is in the past).',
    example: false,
  })
  isStale!: boolean;
}

export class MySocialAnalyticsResponseDto {
  @ApiProperty({ description: 'Current accepted friendship count', example: 42 })
  friends!: number;

  @ApiProperty({ description: 'Current follower count', example: 120 })
  followers!: number;

  @ApiProperty({ description: 'Current following count', example: 88 })
  following!: number;

  @ApiProperty({ description: 'Net follower growth over the last 30 days', example: 12 })
  growth30Days!: number;

  @ApiPropertyOptional({
    description: 'Phase 3 (S-17): timestamp at which the analytics snapshot is stale (ISO 8601).',
    example: '2026-08-10T13:30:00.000Z',
    nullable: true,
  })
  staleAt!: string | null;

  @ApiProperty({
    description: 'Phase 3 (S-17): whether the analytics snapshot is stale.',
    example: false,
  })
  isStale!: boolean;
}
