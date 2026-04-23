import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { DEFAULT_SLUG_PATTERN } from '@/common/utils/slug.util';
import {
  trimString,
  trimStringToLowerCase,
  trimStringToNullIfBlank,
} from '@/common/utils/text.util';
import { CATEGORY_SLUG_INVALID_MESSAGE } from '../../category.constants';

export class CreateCategoryDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToLowerCase(value))
  @IsString()
  @MaxLength(120)
  @Matches(DEFAULT_SLUG_PATTERN, {
    message: CATEGORY_SLUG_INVALID_MESSAGE,
  })
  slug?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;
}
