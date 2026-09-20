import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class TagSlugsQueryDto {
  @ApiPropertyOptional({
    description:
      'Comma-separated list of tag slugs. Repeated `slugs` parameters are also accepted.',
    type: String,
    example: 'react,typescript,node',
    maxItems: 50,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return undefined;
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  slugs?: string[];
}
