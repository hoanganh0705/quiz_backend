import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RankingHistoryItemDto {
  @ApiProperty({ description: 'Snapshot date in YYYY-MM-DD format', example: '2026-06-01' })
  date!: string;

  @ApiProperty({ description: 'User rank at the snapshot time', example: 142 })
  rank!: number;
}

export class RankingHistoryResponseDto {
  @ApiProperty({
    description: 'Historical ranking snapshots',
    type: () => [RankingHistoryItemDto],
  })
  items!: RankingHistoryItemDto[];
}

export class PublicRankingHistoryResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Public username', example: 'Anh' })
  username!: string;

  @ApiProperty({
    description: 'Historical ranking snapshots',
    type: () => [RankingHistoryItemDto],
  })
  history!: RankingHistoryItemDto[];
}

export class PeakRankDto {
  @ApiProperty({ description: 'Best rank achieved for the period', example: 1 })
  rank!: number;

  @ApiPropertyOptional({
    description: 'Timestamp when the peak rank was achieved',
    type: String,
    example: '2026-05-01T12:00:00Z',
    nullable: true,
  })
  achievedAt!: string | null;
}

export class PeakRanksResponseDto {
  @ApiPropertyOptional({
    description: 'Best daily rank achieved',
    type: () => PeakRankDto,
    nullable: true,
  })
  daily!: PeakRankDto | null;

  @ApiPropertyOptional({
    description: 'Best weekly rank achieved',
    type: () => PeakRankDto,
    nullable: true,
  })
  weekly!: PeakRankDto | null;

  @ApiPropertyOptional({
    description: 'Best monthly rank achieved',
    type: () => PeakRankDto,
    nullable: true,
  })
  monthly!: PeakRankDto | null;

  @ApiPropertyOptional({
    description: 'Best all-time rank achieved',
    type: () => PeakRankDto,
    nullable: true,
  })
  allTime!: PeakRankDto | null;
}

export class RankMovementResponseDto {
  @ApiPropertyOptional({
    description: 'Previous snapshot rank',
    type: Number,
    example: 120,
    nullable: true,
  })
  previousRank!: number | null;

  @ApiPropertyOptional({
    description: 'Current snapshot rank',
    type: Number,
    example: 95,
    nullable: true,
  })
  currentRank!: number | null;

  @ApiPropertyOptional({
    description: 'Rank change computed as previousRank - currentRank',
    type: Number,
    example: 25,
    nullable: true,
  })
  change!: number | null;

  @ApiProperty({
    description: 'Movement direction',
    enum: ['up', 'down', 'stable', 'unknown'],
    example: 'up',
  })
  direction!: 'up' | 'down' | 'stable' | 'unknown';
}

export const MILESTONE_ENUM = [
  'TOP_10000',
  'TOP_1000',
  'TOP_100',
  'TOP_50',
  'TOP_10',
  'TOP_3',
  'TOP_1',
] as const;
export type MilestoneEnum = (typeof MILESTONE_ENUM)[number];

export class RankingMilestoneDto {
  @ApiProperty({
    description: 'Milestone identifier',
    enum: MILESTONE_ENUM,
    example: 'TOP_100',
  })
  milestone!: MilestoneEnum;

  @ApiProperty({ description: 'Rank threshold achieved for this milestone', example: 100 })
  rank!: number;

  @ApiProperty({
    description: 'Timestamp when the milestone was first achieved',
    example: '2026-03-10T10:00:00Z',
  })
  achievedAt!: string;
}

export class RankingMilestonesResponseDto {
  @ApiProperty({
    description: 'Ranking milestones achieved by the authenticated user',
    type: () => [RankingMilestoneDto],
  })
  items!: RankingMilestoneDto[];
}
