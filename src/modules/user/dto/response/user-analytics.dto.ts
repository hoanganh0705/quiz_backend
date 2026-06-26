import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserAnalyticsSummaryDto {
  @ApiProperty({ description: 'Total quiz attempts by the user', example: 420 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Completed quizzes', example: 310 })
  completedQuizzes!: number;

  @ApiProperty({
    description: 'Average score percent across attempts',
    example: 83.5,
  })
  averageScore!: number;
}

export class UserAnalyticsFavoriteCategoryDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;
}

export class UserAnalyticsFavoriteTagDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '770e8400-e29b-41d4-a716-446655440111',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;
}

export class UserAnalyticsResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Aggregate summary metrics',
    type: () => UserAnalyticsSummaryDto,
  })
  summary!: UserAnalyticsSummaryDto;

  @ApiPropertyOptional({
    description: 'Most-engaged category (null if user has no activity)',
    type: () => UserAnalyticsFavoriteCategoryDto,
    nullable: true,
  })
  favoriteCategory!: UserAnalyticsFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Most-engaged tag (null if user has no activity)',
    type: () => UserAnalyticsFavoriteTagDto,
    nullable: true,
  })
  favoriteTag!: UserAnalyticsFavoriteTagDto | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the last analytics refresh',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}