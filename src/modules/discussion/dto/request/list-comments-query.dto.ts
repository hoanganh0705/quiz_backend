import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DISCUSSIONS_DEFAULT_PAGE_LIMIT,
  DISCUSSIONS_MAX_PAGE_LIMIT,
} from '../../domain/constants';

/**
 * Cursor-based query DTO for the comment lists
 * (`GET /quizzes/:quizId/comments`, `GET /users/me/comments`,
 * `GET /users/:userId/comments`).
 *
 * All three endpoints use the same `(createdAt, id)` cursor shape
 * — the wire-shape serialization is owned by
 * `mappers/comment-cursor.mapper.ts`.
 */
export class ListCommentsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque pagination cursor returned by the previous page',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAyVDEwOjM1OjAwLjAwMFoiLCJpZCI6Ijg4MGU4NDAwLWUyOWItNzFkNC1hNzE2LTQ0NjY1NTQ0MDAwMDAifQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of top-level comments to return per page',
    example: DISCUSSIONS_DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: DISCUSSIONS_MAX_PAGE_LIMIT,
    default: DISCUSSIONS_DEFAULT_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCUSSIONS_MAX_PAGE_LIMIT)
  limit?: number;
}
