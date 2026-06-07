import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyCommentItemResponseDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({
    description: 'Parent thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Thread title', example: 'How is scoring calculated?' })
  threadTitle!: string;

  @ApiProperty({
    description: 'Quiz identifier the thread belongs to',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Comment content', example: 'I think it is based on response speed.' })
  content!: string;

  @ApiProperty({ description: 'Number of direct replies', example: 3 })
  repliesCount!: number;

  @ApiProperty({ description: 'Net vote count', example: 5 })
  votesCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T10:35:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T10:45:00.000Z',
  })
  updatedAt!: string;
}

export class MyCommentsPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAyVDEwOjM1OjAwLjAwMFoiLCJjb21tZW50SWQiOiI4ODBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ==',
  })
  nextCursor!: string | null;
}

export class MyCommentsResponseDto {
  @ApiProperty({ description: 'Authenticated user comment items', type: () => [MyCommentItemResponseDto] })
  items!: MyCommentItemResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => MyCommentsPaginationResponseDto })
  pagination!: MyCommentsPaginationResponseDto;
}
