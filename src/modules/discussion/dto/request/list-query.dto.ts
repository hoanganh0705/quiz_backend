import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
    example: '660e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  quizId?: string;

  @ApiPropertyOptional({
    description: 'Filter by author UUID',
    format: 'uuid',
    example: '770e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by thread status',
    enum: ['open', 'closed', 'hidden', 'deleted'],
    example: 'open',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['open', 'closed', 'hidden', 'deleted'])
  status?: 'open' | 'closed' | 'hidden' | 'deleted';

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['created_at', 'votes_count', 'comments_count'],
    default: 'created_at',
    example: 'created_at',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['created_at', 'votes_count', 'comments_count'])
  sortBy?: 'created_at' | 'votes_count' | 'comments_count';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
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
    example: '770e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  parentCommentId?: string;
}
