import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserRankingResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiPropertyOptional({
    description: 'User global all-time rank position (1-based)',
    type: Number,
    nullable: true,
    example: 42,
  })
  globalRank!: number | null;

  @ApiProperty({
    description: 'User total score based on all-time XP',
    example: 15420,
  })
  totalScore!: number;

  @ApiProperty({
    description: 'Derived level = floor(totalScore / 500) + 1. Reflects all-time XP progression.',
    example: 14,
  })
  level!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp when ranking was last updated',
    example: '2026-06-25T10:30:00.000Z',
  })
  updatedAt!: string;
}
