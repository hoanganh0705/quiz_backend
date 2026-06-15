import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MySavedThreadItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Discussion thread title', example: 'How does ranking XP work?' })
  title!: string;

  @ApiProperty({ description: 'Number of comments on the thread', example: 18 })
  commentCount!: number;

  @ApiProperty({ description: 'Net vote count on the thread', example: 22 })
  voteCount!: number;

  @ApiProperty({
    description: 'Timestamp when the authenticated user saved the thread',
    example: '2026-06-08T09:00:00Z',
  })
  savedAt!: string;
}

export class MySavedThreadsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJzYXZlZEF0IjoiMjAyNi0wNi0wOFQwOTowMDowMFoiLCJ0aHJlYWRJZCI6IjY2MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class MySavedThreadsResponseDto {
  @ApiProperty({
    description: 'Saved discussion thread items',
    type: () => [MySavedThreadItemResponseDto],
  })
  items!: MySavedThreadItemResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => MySavedThreadsPaginationDto })
  pagination!: MySavedThreadsPaginationDto;
}
