import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscussionThreadSolveResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Whether the thread is marked as solved', example: true })
  isSolved!: boolean;

  @ApiPropertyOptional({
    description: 'Selected solution comment identifier',
    nullable: true,
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  solvedCommentId!: string | null;

  @ApiPropertyOptional({
    description: 'When the thread was marked as solved',
    nullable: true,
    example: '2026-06-08T09:00:00Z',
  })
  solvedAt!: string | null;
}

export class DiscussionThreadUnsolveResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Whether the thread is marked as solved', example: false })
  isSolved!: boolean;
}
