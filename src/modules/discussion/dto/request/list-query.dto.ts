import { Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { ThreadSortField, SortOrder, DiscussionThreadStatus } from '../../domain/types';
import { THREAD_SORT_FIELD, SORT_ORDER, DISCUSSION_THREAD_STATUS } from '../../domain/types';

export class ListThreadsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of threads to return per page',
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
    description: 'Filter by quiz UUID',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  quizId?: string;

  @ApiPropertyOptional({
    description: 'Filter by author UUID',
    format: 'uuid',
    example: '770e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by thread status',
    enum: DISCUSSION_THREAD_STATUS,
    example: 'open',
    nullable: true,
  })
  @IsOptional()
  @IsIn(DISCUSSION_THREAD_STATUS)
  status?: DiscussionThreadStatus;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: THREAD_SORT_FIELD,
    default: 'created_at',
    example: 'created_at',
    nullable: true,
  })
  @IsOptional()
  @IsIn(THREAD_SORT_FIELD)
  sortBy?: ThreadSortField;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SORT_ORDER,
    default: 'desc',
    example: 'desc',
    nullable: true,
  })
  @IsOptional()
  @IsIn(SORT_ORDER)
  sortOrder?: SortOrder;
}

export class ListCommentsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of comments to return per page',
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
    description:
      'UUID of the parent comment to fetch replies for. Omit to fetch only top-level comments.',
    format: 'uuid',
    example: '770e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  parentCommentId?: string;
}
