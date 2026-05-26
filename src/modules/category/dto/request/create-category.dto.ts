import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_SLUG_PATTERN } from '@/common/utils/slug.util';
import {
  trimString,
  trimStringToLowerCase,
  trimStringToNullIfBlank,
} from '@/common/utils/text.util';
import { CATEGORY_SLUG_INVALID_MESSAGE } from '../../category.constants';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    minLength: 1,
    maxLength: 120,
    example: 'General Knowledge',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Category description',
    maxLength: 500,
    example: 'Test your knowledge across a wide range of topics',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated from name if omitted)',
    maxLength: 120,
    pattern: DEFAULT_SLUG_PATTERN.source,
    example: 'general-knowledge',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToLowerCase(value))
  @IsString()
  @MaxLength(120)
  @Matches(DEFAULT_SLUG_PATTERN, {
    message: CATEGORY_SLUG_INVALID_MESSAGE,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Category cover image URL',
    maxLength: 2048,
    format: 'uri',
    example: 'https://example.com/images/general-knowledge.jpg',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;
}
