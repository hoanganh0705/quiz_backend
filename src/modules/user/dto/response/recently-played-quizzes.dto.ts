import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';

/**
 * Phase 3 (S-16): one row in the user's recently-played-quizzes
 * list. `playedAt` is the attempt-finish timestamp (latest when
 * the user replays); `scorePercent` is the final score 0–100.
 */
export class RecentlyPlayedQuizItemDto {
  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiProperty({
    description: 'Difficulty surfaced on the row',
    example: 'medium',
    enum: ['easy', 'medium', 'hard'],
  })
  difficulty!: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    description: 'Quiz cover image URL',
    format: 'uri',
    example: 'https://example.com/covers/js.png',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the user last played the quiz (ISO 8601)',
    example: '2026-08-09T13:30:00.000Z',
  })
  playedAt!: string;

  @ApiProperty({ description: 'Final score percentage (0–100)', example: 92.5 })
  scorePercent!: number;
}

export class RecentlyPlayedQuizzesResponseDto {
  @ApiProperty({
    description: 'Recently played quizzes, newest first',
    type: () => [RecentlyPlayedQuizItemDto],
  })
  items!: RecentlyPlayedQuizItemDto[];

  @ApiProperty({ description: 'Cursor pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}
