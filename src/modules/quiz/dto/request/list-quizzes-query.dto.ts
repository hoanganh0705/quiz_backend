import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '../../types/quiz.types';

/**
 * Phase 2 (S-12): added three first-class filter / sort dimensions.
 *   - `q`        — Postgres full-text search over `quiz_search_vector`.
 *   - `sort`     — 'newest' (default) | 'popular' | 'top_rated' | 'trending'.
 *   - `isHidden` — admin-only filter; the controller strips this for
 *                   non-privileged callers.
 *   - `minRating`— 1..5 filter; used by the `top_rated` sort.
 *
 * The `q` parameter routes through the schema's GENERATED tsvector
 * column. The `sort` parameter routes through `ORDER BY` clauses
 * the repository picks per value.
 */
export class ListQuizzesQueryDto {
  /**
   * Phase 2 (S-12): full-text search term. Mirrors the behaviour of
   * the search module (case-insensitive prefix match, no stemming).
   */
  @ApiPropertyOptional({
    description: 'Full-text search term (matches title, description, slug)',
    example: 'javascript fundamentals',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @MinLength(2)
  q?: string;

  /**
   * Phase 2 (S-12): server-controlled sort.
   */
  @ApiPropertyOptional({
    description: 'Sort order for the listing',
    enum: ['newest', 'popular', 'top_rated', 'trending'],
    default: 'newest',
    example: 'newest',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['newest', 'popular', 'top_rated', 'trending'])
  sort?: 'newest' | 'popular' | 'top_rated' | 'trending';

  /**
   * Phase 2 (S-12): admin-only filter. Stripped from the request
   * for non-privileged callers.
   */
  @ApiPropertyOptional({
    description: 'Admin-only filter — show hidden quizzes (or only hidden when `true`)',
    type: Boolean,
    nullable: true,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return value;
  })
  @IsBoolean()
  isHidden?: boolean;

  /**
   * Phase 2 (S-12): minimum average rating filter (1..5).
   * Combined with `sort=top_rated` by the frontend; mutually
   * independent at the request layer.
   */
  @ApiPropertyOptional({
    description: 'Minimum average rating (1–5 inclusive)',
    minimum: 1,
    maximum: 5,
    nullable: true,
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of quizzes to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by quiz difficulty',
    enum: QUIZ_DIFFICULTIES,
    example: 'medium',
    nullable: true,
  })
  @IsOptional()
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty?: QuizDifficulty;

  @ApiPropertyOptional({
    description: 'Filter by category UUID (must be a valid UUID v4)',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by one or more tag UUIDs (OR semantics — quiz matches if it has at least one of the given tags). Must be valid UUID v4 values.',
    type: String,
    isArray: true,
    format: 'uuid',
    maxItems: 50,
    example: ['770e8400-e29b-71d4-a716-446655440000', '880e8400-e29b-71d4-a716-446655440001'],
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') return [value];
    return value;
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('7', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by creator/owner UUID',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('7')
  creatorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by quiz status (draft or published)',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  @ApiPropertyOptional({
    description: 'Filter to featured quizzes only',
    type: Boolean,
    default: false,
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return value;
  })
  @IsBoolean()
  featured?: boolean;
}
