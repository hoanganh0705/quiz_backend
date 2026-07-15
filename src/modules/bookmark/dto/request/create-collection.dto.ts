import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCollectionDto {
  @ApiProperty({
    description:
      'Collection name. Whitespace is trimmed before validation; names ' +
      'containing only whitespace are rejected (must be at least 1 character ' +
      'after trimming). Must be unique per owner.',
    minLength: 1,
    maxLength: 100,
    example: 'My Favorite Quizzes',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Collection description (optional, may be null)',
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
