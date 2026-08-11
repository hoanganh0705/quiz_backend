import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const LEADERBOARD_PERIOD_VALUES = ['weekly', 'monthly', 'all_time'] as const;

export class FriendRankingEntryDto {
  @ApiProperty({ description: 'Rank position among friends', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Alice', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'XP earned in this period', example: 1500 })
  xp!: number;

  @ApiProperty({
    description: 'Timestamp when friendship was established (ISO 8601)',
    example: '2025-05-15T08:00:00.000Z',
  })
  friendSince!: string;
}

/**
 * Phase 3 (S-20): the user's own row in the leaderboard.
 * Renamed from `number | null` to a structured projection so the
 * viewer's own `xp` and `totalParticipants` reach the UI without
 * a second round-trip.
 */
export class CurrentUserRankDto {
  @ApiProperty({ description: "The viewer's 1-indexed rank among friends", example: 4 })
  rank!: number;

  @ApiProperty({ description: "The viewer's XP in the period", example: 920 })
  xp!: number;

  @ApiProperty({ description: 'Total number of participating friends', example: 12 })
  totalParticipants!: number;
}

export class FriendLeaderboardDto {
  @ApiProperty({
    description: 'Leaderboard period',
    enum: LEADERBOARD_PERIOD_VALUES,
    example: 'weekly',
  })
  period!: (typeof LEADERBOARD_PERIOD_VALUES)[number];

  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [FriendRankingEntryDto],
  })
  entries!: FriendRankingEntryDto[];

  /**
   * Phase 3 (S-20): the viewer's own rank projection (was
   * `number | null`). Null when the viewer has no XP in the
   * period and is therefore not ranked.
   */
  @ApiPropertyOptional({
    description:
      "The current user's rank projection (rank + xp + totalParticipants). Null when the viewer is unranked in the period.",
    nullable: true,
    type: () => CurrentUserRankDto,
  })
  currentUserRank!: CurrentUserRankDto | null;

  @ApiProperty({ description: 'Total number of participating friends', example: 12 })
  totalParticipants!: number;

  /**
   * Phase 3 (S-17): consistency envelope. `staleAt` is the
   * timestamp at which the cache entry is considered stale;
   * `isStale` is the derived boolean for consumers that prefer
   * a truthy shortcut.
   */
  @ApiPropertyOptional({
    description:
      'Phase 3 (S-17): timestamp at which the cached projection is stale (ISO 8601). Null when fresh.',
    example: '2026-08-10T13:30:00.000Z',
    nullable: true,
  })
  staleAt!: string | null;

  @ApiProperty({
    description: 'Phase 3 (S-17): whether the leaderboard projection is stale.',
    example: false,
  })
  isStale!: boolean;
}
