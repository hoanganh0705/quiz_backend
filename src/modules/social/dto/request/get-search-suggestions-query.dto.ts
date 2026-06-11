import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GetSearchSuggestionsQueryDto {
  @ApiProperty({
    description: 'Username prefix to search for',
    example: 'an',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions',
    example: 10,
    minimum: 1,
    maximum: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10;
}
