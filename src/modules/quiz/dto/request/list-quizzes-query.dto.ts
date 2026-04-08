import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export class ListQuizzesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty?: (typeof QUIZ_DIFFICULTIES)[number];

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  tagId?: string;
}
