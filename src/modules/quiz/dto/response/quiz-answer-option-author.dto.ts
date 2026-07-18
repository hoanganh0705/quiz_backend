import { ApiProperty } from '@nestjs/swagger';

/**
 * Author-facing answer option DTO. Includes the `isCorrect` flag so quiz
 * authors can verify the correct answer for each option.
 *
 * For player-facing endpoints, use `QuizAnswerOptionPlayerDto` instead — it
 * omits `isCorrect` to prevent spoilers before/during a quiz attempt.
 */
export class QuizAnswerOptionAuthorDto {
  @ApiProperty({
    description: 'Unique answer option identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  optionId!: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  position!: number;

  @ApiProperty({ description: 'Answer text', example: 'console.log' })
  value!: string;

  @ApiProperty({ description: 'Whether this is the correct answer', example: true })
  isCorrect!: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  createdAt!: string;
}
