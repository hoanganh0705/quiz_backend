import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptStatsFavoriteCategoryDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440001',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;
}

export class AttemptStatsFavoriteTagDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440002',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;
}

export class UserAttemptStatsResponseDto {
  @ApiProperty({ description: 'Total number of attempts ever started', example: 42 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Number of attempts that reached completed status', example: 35 })
  completedAttempts!: number;

  @ApiProperty({ description: 'Number of attempts that were abandoned', example: 5 })
  abandonedAttempts!: number;

  @ApiProperty({
    description: 'Average score across all completed attempts (0–100)',
    example: 78.5,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Total time spent across all attempts, in seconds',
    example: 12540,
  })
  totalTimeSpentSeconds!: number;

  @ApiPropertyOptional({
    description: 'Category attempted most frequently. Null if no attempts have been made.',
    type: AttemptStatsFavoriteCategoryDto,
    nullable: true,
    example: { categoryId: '550e8400-e29b-71d4-a716-446655440001', name: 'Science' },
  })
  favoriteCategory!: AttemptStatsFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Tag attempted most frequently. Null if no attempts have been made.',
    type: AttemptStatsFavoriteTagDto,
    nullable: true,
    example: { tagId: '550e8400-e29b-71d4-a716-446655440002', name: 'Physics' },
  })
  favoriteTag!: AttemptStatsFavoriteTagDto | null;

  @ApiPropertyOptional({
    description: 'Timestamp of the most recent attempt (ISO 8601). Null if no attempts exist.',
    type: String,
    nullable: true,
    example: '2025-06-05T14:30:00.000Z',
  })
  lastAttemptAt!: string | null;
}
