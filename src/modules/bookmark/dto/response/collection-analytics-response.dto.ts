import { ApiProperty } from '@nestjs/swagger';

export class BookmarkCollectionAnalyticsSummaryDto {
  @ApiProperty({ description: 'Total number of bookmarks in the collection', example: 24 })
  totalBookmarks!: number;

  @ApiProperty({
    description: 'Number of unique quizzes bookmarked in the collection',
    example: 24,
  })
  totalQuizzes!: number;

  @ApiProperty({
    description: 'Average rating across all quizzes in the collection (0–5 scale)',
    example: 4.2,
  })
  averageQuizRating!: number;

  @ApiProperty({
    description: 'Number of distinct categories represented across the bookmarks',
    example: 6,
  })
  uniqueCategories!: number;

  @ApiProperty({
    description: 'Number of distinct tags represented across the bookmarks',
    example: 11,
  })
  uniqueTags!: number;
}

export class BookmarkCollectionAnalyticsTopCategoryDto {
  @ApiProperty({ description: 'Category identifier', format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'Science' })
  name!: string;

  @ApiProperty({ description: 'Kebab-case category slug', example: 'science' })
  slug!: string;

  @ApiProperty({
    description: 'Number of bookmarks belonging to this category within the collection',
    example: 8,
  })
  bookmarkCount!: number;
}

export class BookmarkCollectionAnalyticsTopTagDto {
  @ApiProperty({ description: 'Tag identifier', format: 'uuid' })
  tagId!: string;

  @ApiProperty({ description: 'Tag name', example: 'Physics' })
  name!: string;

  @ApiProperty({ description: 'Kebab-case tag slug', example: 'physics' })
  slug!: string;

  @ApiProperty({
    description: 'Number of bookmarks carrying this tag within the collection',
    example: 5,
  })
  bookmarkCount!: number;
}

export class BookmarkCollectionAnalyticsResponseDto {
  @ApiProperty({ description: 'Collection identifier', format: 'uuid' })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Frontend Study List' })
  collectionName!: string;

  @ApiProperty({
    description: 'Aggregate counts and averages for the collection',
    type: BookmarkCollectionAnalyticsSummaryDto,
  })
  summary!: BookmarkCollectionAnalyticsSummaryDto;

  @ApiProperty({
    description: 'Top categories represented in the collection, sorted by bookmark count',
    type: [BookmarkCollectionAnalyticsTopCategoryDto],
  })
  topCategories!: BookmarkCollectionAnalyticsTopCategoryDto[];

  @ApiProperty({
    description: 'Top tags represented in the collection, sorted by bookmark count',
    type: [BookmarkCollectionAnalyticsTopTagDto],
  })
  topTags!: BookmarkCollectionAnalyticsTopTagDto[];

  @ApiProperty({
    description: 'ISO 8601 timestamp when these analytics were last computed',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}
