import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewDashboardFavoriteCategoryDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;
}

export class ReviewDashboardFavoriteTagDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Biology' })
  name!: string;
}

export class ReviewDashboardResponseDto {
  @ApiProperty({
    description: 'Total number of reviews created by the authenticated user',
    example: 85,
  })
  totalReviews!: number;

  @ApiProperty({ description: 'Average rating given by the authenticated user', example: 4.2 })
  averageRatingGiven!: number;

  @ApiPropertyOptional({
    description: 'Most reviewed category across the authenticated user reviews',
    type: () => ReviewDashboardFavoriteCategoryDto,
    nullable: true,
  })
  favoriteCategory!: ReviewDashboardFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Most reviewed tag across the authenticated user reviews',
    type: () => ReviewDashboardFavoriteTagDto,
    nullable: true,
  })
  favoriteTag!: ReviewDashboardFavoriteTagDto | null;

  @ApiProperty({
    description: 'Timestamp when the dashboard was last calculated (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}
