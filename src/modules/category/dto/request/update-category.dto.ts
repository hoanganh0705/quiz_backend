import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, {
    message: 'Slug must be lowercase and can only contain letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;
}
