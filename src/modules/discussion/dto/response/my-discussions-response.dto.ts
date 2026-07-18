import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyDiscussionItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Quiz identifier the thread belongs to',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Thread title', example: 'How is scoring calculated?' })
  title!: string;

  @ApiProperty({ description: 'Total comment count', example: 10 })
  commentCount!: number;

  @ApiProperty({ description: 'Net vote count', example: 25 })
  voteCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T11:00:00.000Z',
  })
  updatedAt!: string;
}

export class MyDiscussionsPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAyVDEwOjMwOjAwLjAwMFoiLCJ0aHJlYWRJZCI6IjY2MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class MyDiscussionsResponseDto {
  @ApiProperty({
    description: 'Authenticated user discussion items',
    type: () => [MyDiscussionItemResponseDto],
  })
  items!: MyDiscussionItemResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => MyDiscussionsPaginationResponseDto,
  })
  pagination!: MyDiscussionsPaginationResponseDto;
}
