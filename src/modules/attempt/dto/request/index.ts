import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ATTEMPT_CONTEXT_TYPES, type AttemptContextType } from '../../types/attempt.types';

export class StartAttemptDto {
  @ApiPropertyOptional({
    description:
      'Optional reference ID for the context this attempt belongs to (e.g. tournament ID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  contextRefId?: string;

  @ApiPropertyOptional({
    description: 'Context type for this attempt',
    enum: ATTEMPT_CONTEXT_TYPES,
    example: 'solo',
    nullable: true,
  })
  @IsOptional()
  @IsIn(ATTEMPT_CONTEXT_TYPES)
  contextType?: AttemptContextType;
}

export class ListMyAttemptsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of attempts to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SubmitAnswerDto {
  @ApiProperty({
    description: 'UUID of the question being answered',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4')
  questionId!: string;

  @ApiPropertyOptional({
    description: 'UUID of the selected answer option. Omit or send `null` to skip this question.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  selectedOptionId?: string | null;

  @ApiPropertyOptional({
    description: 'Time taken to answer in milliseconds',
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeTakenMs?: number | null;
}
