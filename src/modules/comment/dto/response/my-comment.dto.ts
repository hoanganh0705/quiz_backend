import { ApiProperty } from '@nestjs/swagger';

/**
 * Wire-shape projection of a comment when it is returned as part of a
 * user-history list (`GET /users/me/comments` or
 * `GET /users/:userId/comments`). Denormalizes the quiz title for
 * display; the repository JOINs `comments` to `quizzes` to
 * populate it.
 */
export class MyCommentDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Quiz the comment belongs to',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title (denormalized for display)',
    example: 'Closures and Scope',
  })
  quizTitle!: string;

  @ApiProperty({ description: 'Comment body text', example: 'Great question!' })
  body!: string;

  @ApiProperty({ description: 'Net vote count', example: 5 })
  votesCount!: number;

  @ApiProperty({ description: 'Number of direct replies', example: 3 })
  repliesCount!: number;

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
