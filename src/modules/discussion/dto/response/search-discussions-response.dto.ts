import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscussionAuthorResponseDto } from './discussion-author-response.dto';

export class SearchDiscussionItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Quiz identifier the thread belongs to',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Thread title', example: 'How is scoring calculated?' })
  title!: string;

  @ApiProperty({ description: 'Thread author', type: () => DiscussionAuthorResponseDto })
  author!: DiscussionAuthorResponseDto;

  @ApiProperty({ description: 'Number of comments', example: 5 })
  commentCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-01T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

export class SearchDiscussionsPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJzY29yZSI6IjIwMjYtMDYtMDFUMTA6MDA6MDAuMDAwWiIsInRocmVhZElkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class SearchDiscussionsResponseDto {
  @ApiProperty({
    description: 'Matching discussion thread items',
    type: () => [SearchDiscussionItemResponseDto],
  })
  items!: SearchDiscussionItemResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => SearchDiscussionsPaginationResponseDto,
  })
  pagination!: SearchDiscussionsPaginationResponseDto;
}
