import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookmarkStatsFavoriteCategoryDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440001',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;

  @ApiProperty({ description: 'Category URL slug', example: 'science' })
  slug!: string;
}

export class BookmarkStatsFavoriteTagDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440002',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;

  @ApiProperty({ description: 'Tag URL slug', example: 'physics' })
  slug!: string;
}

export class BookmarkStatsResponseDto {
  @ApiProperty({
    description: 'Total number of bookmark collections owned by the user',
    example: 3,
  })
  totalCollections!: number;

  @ApiProperty({
    description: 'Total number of bookmarked quizzes across all collections',
    example: 27,
  })
  totalBookmarks!: number;

  @ApiPropertyOptional({
    description: 'Category with the most bookmarked quizzes. Null if no bookmarks exist.',
    type: () => BookmarkStatsFavoriteCategoryDto,
    nullable: true,
  })
  favoriteCategory!: BookmarkStatsFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Tag with the most bookmarked quizzes. Null if no bookmarks exist.',
    type: () => BookmarkStatsFavoriteTagDto,
    nullable: true,
  })
  favoriteTag!: BookmarkStatsFavoriteTagDto | null;
}
