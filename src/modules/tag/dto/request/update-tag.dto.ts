import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_SLUG_PATTERN } from '@/common/utils/slug.util';
import { trimString, trimStringToLowerCase } from '@/common/utils/text.util';
import { TAG_SLUG_INVALID_MESSAGE } from '../../tag.constants';

export class UpdateTagDto {
  @ApiPropertyOptional({
    description: 'Tag name',
    minLength: 1,
    maxLength: 120,
    example: 'TypeScript',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug',
    maxLength: 120,
    pattern: DEFAULT_SLUG_PATTERN.source,
    example: 'typescript',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToLowerCase(value))
  @IsString()
  @MaxLength(120)
  @Matches(DEFAULT_SLUG_PATTERN, {
    message: TAG_SLUG_INVALID_MESSAGE,
  })
  slug?: string;
}
