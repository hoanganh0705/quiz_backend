import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ATTEMPT_CONTEXT_TYPES,
  ATTEMPT_STATUSES,
  type AttemptContextType,
  type AttemptStatus,
} from '../../types/attempt.types';
import {
  ATTEMPT_LIST_SORT_FIELDS,
  type AttemptListSortField,
} from '../../mappers/attempt-cursor.mapper';

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
      'eyJzb3J0QnkiOiJjcmVhdGVkQXQiLCJzb3J0VmFsdWUiOiIyMDI1LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJhdHRlbXB0SWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNCJ9',
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

  @ApiPropertyOptional({
    description: 'Filter attempts by status',
    enum: ATTEMPT_STATUSES,
    example: 'completed',
    nullable: true,
  })
  @IsOptional()
  @IsIn(ATTEMPT_STATUSES)
  status?: AttemptStatus;

  @ApiPropertyOptional({
    description: 'Filter attempts by quiz identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440100',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  quizId?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts by category identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440101',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts by tag identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440102',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  tagId?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts created on or after this ISO 8601 timestamp',
    example: '2025-01-01T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts created on or before this ISO 8601 timestamp',
    example: '2025-12-31T23:59:59.999Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Sort field for attempt history',
    enum: ATTEMPT_LIST_SORT_FIELDS,
    example: 'createdAt',
    default: 'createdAt',
    nullable: true,
  })
  @IsOptional()
  @IsIn(ATTEMPT_LIST_SORT_FIELDS)
  sortBy?: AttemptListSortField;
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
