import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Search term used across users, quizzes, and discussion threads',
    example: 'nestjs advanced',
    minLength: 2,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  })
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return per section',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10;
}
