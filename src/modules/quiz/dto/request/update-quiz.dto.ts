import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_SLUG_PATTERN } from '@/common/utils/slug.util';
import {
  trimString,
  trimStringToLowerCase,
  trimStringToNullIfBlank,
} from '@/common/utils/text.util';
import { QUIZ_SLUG_INVALID_MESSAGE } from '../../quiz.constants';

export class UpdateQuizDto {
  @ApiPropertyOptional({
    description: 'Quiz title',
    minLength: 1,
    maxLength: 255,
    example: 'Advanced JavaScript',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Quiz description',
    type: String,
    maxLength: 2000,
    example:
      'Test your advanced JavaScript knowledge including closures, prototypes, and async patterns.',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'URL-friendly slug',
    maxLength: 120,
    pattern: DEFAULT_SLUG_PATTERN.source,
    example: 'advanced-javascript',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToLowerCase(value))
  @IsString()
  @MaxLength(120)
  @Matches(DEFAULT_SLUG_PATTERN, {
    message: QUIZ_SLUG_INVALID_MESSAGE,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Prerequisites',
    type: String,
    maxLength: 5000,
    example: 'Basic understanding of JavaScript fundamentals',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(5000)
  requirements?: string | null;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    maxLength: 2048,
    format: 'uri',
    example: 'https://example.com/covers/advanced-javascript.png',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Featured on home page',
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Hidden from public listings',
    example: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({
    description: 'Associated category UUID',
    type: String,
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Associated tag UUIDs (max 50)',
    type: Array,
    maxItems: 50,
    format: 'uuid',
    example: ['770e8400-e29b-41d4-a716-446655440000'],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
