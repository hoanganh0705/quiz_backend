import { ApiProperty } from '@nestjs/swagger';

/**
 * Player-facing answer option DTO. Intentionally omits the `isCorrect` flag
 * to prevent spoilers — players should not see correct answers before or
 * during an attempt.
 *
 * After a player completes an attempt, they see correct answers through the
 * post-attempt review endpoint (`GET /attempts/:attemptId/review`), which
 * embeds the author DTO instead.
 */
export class QuizAnswerOptionPlayerDto {
  @ApiProperty({
    description: 'Unique answer option identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  optionId!: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  position!: number;

  @ApiProperty({ description: 'Answer text', example: 'console.log' })
  value!: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  createdAt!: string;
}
