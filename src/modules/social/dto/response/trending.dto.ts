import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TREND_REASON_VALUES = [
  'most_followed',
  'fastest_growing',
  'most_active',
  'rising_star',
] as const;

export class TrendingUserResponseDto {
  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'Anh' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/anh.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Current follower count', example: 1250 })
  followers!: number;

  @ApiProperty({ description: 'Weighted trending score', example: 842 })
  trendScore!: number;

  @ApiProperty({
    description: 'Primary reason why this user is trending',
    enum: TREND_REASON_VALUES,
    example: 'fastest_growing',
  })
  trendReason!: (typeof TREND_REASON_VALUES)[number];
}

export class TrendingUsersListResponseDto {
  @ApiProperty({ description: 'Trending users', type: () => [TrendingUserResponseDto] })
  items!: TrendingUserResponseDto[];
}
