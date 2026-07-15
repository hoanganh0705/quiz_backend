import { Transform, Type } from 'class-transformer';
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
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '../../types/quiz.types';

export class ListQuizzesQueryDto {
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
    example: '660e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by one or more tag UUIDs (OR semantics — quiz matches if it has at least one of the given tags). Must be valid UUID v4 values.',
    type: String,
    isArray: true,
    format: 'uuid',
    maxItems: 50,
    example: ['770e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440001'],
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    // Query string `?tagIds=<uuid>` parses as a single string; wrap it so
    // the existing `@IsArray()` contract accepts both forms (single value
    // and repeated `?tagIds=<uuid>&tagIds=<uuid>`) without changing the
    // OpenAPI surface.
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') return [value];
    return value;
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
