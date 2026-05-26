import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '../../types/quiz.types';

export class UpdateQuizVersionDto {
  @ApiPropertyOptional({
    description: 'Quiz difficulty level',
    enum: QUIZ_DIFFICULTIES,
    example: 'hard',
  })
  @IsOptional()
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty?: QuizDifficulty;

  @ApiPropertyOptional({ description: 'Time limit in milliseconds', minimum: 1, example: 900000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMs?: number;

  @ApiPropertyOptional({
    description: 'Minimum score percent to pass',
    minimum: 0,
    maximum: 100,
    example: 80,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScorePercent?: number;

  @ApiPropertyOptional({ description: 'XP reward for passing', minimum: 0, example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardXp?: number;
}
