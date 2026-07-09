import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '../../types/quiz.types';

export class CreateQuizVersionDto {
  @ApiPropertyOptional({
    description: 'Source version UUID to copy questions from (optional)',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  sourceVersionId?: string;

  @ApiProperty({ description: 'Quiz difficulty level', enum: QUIZ_DIFFICULTIES, example: 'medium' })
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', minimum: 1, example: 600000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMs!: number;

  @ApiProperty({
    description: 'Minimum score percent to pass',
    minimum: 0,
    maximum: 100,
    example: 70,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScorePercent!: number;

  @ApiProperty({ description: 'XP reward for passing', minimum: 0, example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardXp!: number;
}
