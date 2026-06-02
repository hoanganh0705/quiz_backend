import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';

export class UpdateThreadDto {
  @ApiPropertyOptional({
    description: 'Updated thread title',
    minLength: 1,
    maxLength: 255,
    example: 'Clarification on JavaScript closures',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? trimString(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated thread body text',
    minLength: 1,
    maxLength: 10000,
    example: 'After reading more, I now understand closures...',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? trimString(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body?: string;
}
