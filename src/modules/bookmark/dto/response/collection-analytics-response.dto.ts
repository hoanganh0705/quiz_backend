import { ApiProperty } from '@nestjs/swagger';

export class BookmarkCollectionAnalyticsSummaryDto {
  @ApiProperty({ example: 24 })
  totalBookmarks!: number;

  @ApiProperty({ example: 24 })
  totalQuizzes!: number;

  @ApiProperty({ example: 4.2 })
  averageQuizRating!: number;

  @ApiProperty({ example: 6 })
  uniqueCategories!: number;

  @ApiProperty({ example: 11 })
  uniqueTags!: number;
}

export class BookmarkCollectionAnalyticsTopCategoryDto {
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'Science' })
  name!: string;

  @ApiProperty({ example: 'science' })
  slug!: string;

  @ApiProperty({ example: 8 })
  bookmarkCount!: number;
}

export class BookmarkCollectionAnalyticsTopTagDto {
  @ApiProperty({ format: 'uuid' })
  tagId!: string;

  @ApiProperty({ example: 'Physics' })
  name!: string;

  @ApiProperty({ example: 'physics' })
  slug!: string;

  @ApiProperty({ example: 5 })
  bookmarkCount!: number;
}

export class BookmarkCollectionAnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  collectionId!: string;

  @ApiProperty({ example: 'Frontend Study List' })
  collectionName!: string;

  @ApiProperty({ type: BookmarkCollectionAnalyticsSummaryDto })
  summary!: BookmarkCollectionAnalyticsSummaryDto;

  @ApiProperty({ type: [BookmarkCollectionAnalyticsTopCategoryDto] })
  topCategories!: BookmarkCollectionAnalyticsTopCategoryDto[];

  @ApiProperty({ type: [BookmarkCollectionAnalyticsTopTagDto] })
  topTags!: BookmarkCollectionAnalyticsTopTagDto[];

  @ApiProperty({ example: '2026-06-05T01:00:00.000Z' })
  lastUpdated!: string;
}
