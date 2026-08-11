import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Phase 2 (S-13): query DTO for `GET /tags/by-slugs`.
 *
 * The `slugs` query parameter accepts a comma-separated list:
 *   GET /tags/by-slugs?slugs=react,typescript,node
 *
 * The transform normalises single strings / repeated query params
 * into an array, deduplicates values, and trims whitespace.
 * `ArrayMaxSize` is intentionally generous (50) to mirror the
 * listing endpoint's tag filter cap.
 */
export class TagSlugsQueryDto {
  @ApiPropertyOptional({
    description:
      'Comma-separated list of tag slugs. Repeated `slugs` parameters are also accepted.',
    type: String,
    example: 'react,typescript,node',
    maxItems: 50,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return value;
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  slugs?: string[];
}
