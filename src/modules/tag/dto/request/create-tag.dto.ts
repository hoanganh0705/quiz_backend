import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { DEFAULT_SLUG_PATTERN } from '@/common/utils/slug.util';
import { trimString, trimStringToLowerCase } from '@/common/utils/text.util';
import { TAG_SLUG_INVALID_MESSAGE } from '../../tag.constants';

export class CreateTagDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToLowerCase(value))
  @IsString()
  @MaxLength(120)
  @Matches(DEFAULT_SLUG_PATTERN, {
    message: TAG_SLUG_INVALID_MESSAGE,
  })
  slug?: string;
}
