import { ApiProperty } from '@nestjs/swagger';

export class UserAnalyticsSummaryDto {
  @ApiProperty({ example: 420 })
  totalAttempts!: number;

  @ApiProperty({ example: 310 })
  completedQuizzes!: number;

  @ApiProperty({ example: 83.5 })
  averageScore!: number;
}

export class UserAnalyticsFavoriteCategoryDto {
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'Science' })
  name!: string;
}

export class UserAnalyticsFavoriteTagDto {
  @ApiProperty({ format: 'uuid' })
  tagId!: string;

  @ApiProperty({ example: 'Physics' })
  name!: string;
}

export class UserAnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: UserAnalyticsSummaryDto })
  summary!: UserAnalyticsSummaryDto;

  @ApiProperty({ type: UserAnalyticsFavoriteCategoryDto, nullable: true })
  favoriteCategory!: UserAnalyticsFavoriteCategoryDto | null;

  @ApiProperty({ type: UserAnalyticsFavoriteTagDto, nullable: true })
  favoriteTag!: UserAnalyticsFavoriteTagDto | null;

  @ApiProperty({ example: '2026-06-05T01:00:00.000Z' })
  lastUpdated!: string;
}
