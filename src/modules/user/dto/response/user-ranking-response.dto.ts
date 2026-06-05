import { ApiProperty } from '@nestjs/swagger';

export class UserRankingResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true, description: 'User global all-time rank' })
  globalRank!: number | null;

  @ApiProperty({ description: 'User total score based on all-time XP' })
  totalScore!: number;

  @ApiProperty({ description: 'Derived user level from total score' })
  level!: number;

  @ApiProperty({ description: 'ISO 8601 timestamp when ranking was last updated' })
  updatedAt!: string;
}
