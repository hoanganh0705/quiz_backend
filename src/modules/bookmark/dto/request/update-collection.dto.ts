import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCollectionDto {
  @ApiPropertyOptional({
    description: 'Updated collection name',
    minLength: 1,
    maxLength: 100,
    example: 'My Renamed Collection',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated collection description (omit to leave unchanged)',
    type: String,
    nullable: true,
    maxLength: 500,
    example: 'A curated set of frontend interview quizzes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
