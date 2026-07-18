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

  @ApiPropertyOptional({
    description: "The current user's rank among friends (null if not ranked)",
    example: 3,
    nullable: true,
  })
  currentUserRank!: number | null;

  @ApiProperty({ description: 'Total number of participating friends', example: 12 })
  totalParticipants!: number;
}
