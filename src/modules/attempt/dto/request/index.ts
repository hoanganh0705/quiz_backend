import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ATTEMPT_CONTEXT_TYPES, type AttemptContextType } from '../../types/attempt.types';

export class StartAttemptDto {
  @IsOptional()
  @IsString()
  contextRefId?: string;

  @IsOptional()
  @IsIn(ATTEMPT_CONTEXT_TYPES)
  contextType?: AttemptContextType;
}

export class ListMyAttemptsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SubmitAnswerDto {
  @IsUUID('4')
  questionId!: string;

  @IsOptional()
  @IsUUID('4')
  selectedOptionId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeTakenMs?: number | null;
}
