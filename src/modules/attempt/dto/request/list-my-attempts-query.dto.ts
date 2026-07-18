import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ATTEMPT_STATUSES, type AttemptStatus } from '../../types/attempt.types';
import {
  ATTEMPT_LIST_SORT_FIELDS,
  type AttemptListSortField,
} from '../../mappers/attempt-cursor.mapper';

export class ListMyAttemptsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    type: String,
    nullable: true,
    example:
      'eyJzb3J0QnkiOiJjcmVhdGVkQXQiLCJzb3J0VmFsdWUiOiIyMDI1LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJhdHRlbXB0SWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwOTkifQ==',
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
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter attempts by status',
    type: String,
    enum: ATTEMPT_STATUSES,
    example: 'completed',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  status?: AttemptStatus;

  @ApiPropertyOptional({
    description: 'Filter attempts by quiz identifier',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440100',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  quizId?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts by category identifier',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440101',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts by tag identifier',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440102',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  tagId?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts created on or after this ISO 8601 timestamp',
    type: String,
    example: '2025-01-01T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts created on or before this ISO 8601 timestamp',
    type: String,
    example: '2025-12-31T23:59:59.999Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Sort field for attempt history',
    type: String,
    enum: ATTEMPT_LIST_SORT_FIELDS,
    example: 'createdAt',
    default: 'createdAt',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  sortBy?: AttemptListSortField;
}
