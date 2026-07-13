import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '@/modules/quiz/types/quiz.types';

/**
 * Query DTO for `GET /categories/:slug/quizzes`.
 *
 * The category is already uniquely identified by the path parameter `:slug`,
 * so `categoryId` is intentionally absent. Clients that need a different
 * scope should call the regular `GET /quizzes` endpoint and filter by
 * `categoryId` there.
 */
export class ListCategoryQuizzesQueryDto {
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
    description:
      'Optional list of tag UUIDs to further narrow the category quizzes (OR semantics — quiz matches if it has at least one of the given tags)',
    type: String,
    isArray: true,
    format: 'uuid',
    maxItems: 50,
    example: ['770e8400-e29b-41d4-a716-446655440000'],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tagIds?: string[];
}
