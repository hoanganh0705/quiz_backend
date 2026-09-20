import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength, MaxLength } from 'class-validator';

export class GetUsersSearchQueryDto {
  @ApiProperty({
    description: 'Username prefix or substring to search for',
    example: 'an',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q!: string;

  @ApiProperty({
    description: 'Maximum number of results',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit!: number;
}
