import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export class CreateQuizVersionDto {
  @IsOptional()
  @IsUUID('4')
  sourceVersionId?: string;

  @IsIn(QUIZ_DIFFICULTIES)
  difficulty!: (typeof QUIZ_DIFFICULTIES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScorePercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardXp!: number;
}
