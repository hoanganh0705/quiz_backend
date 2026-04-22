import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export class UpdateQuizVersionDto {
  @IsOptional()
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty?: (typeof QUIZ_DIFFICULTIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScorePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardXp?: number;
}
