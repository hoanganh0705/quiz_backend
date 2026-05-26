import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DEFAULT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCollectionDto {
  @ApiProperty({
    description: 'Collection name',
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
    description: 'Collection description',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class AddBookmarkDto {
  @ApiProperty({
    description: 'UUID of the quiz to bookmark',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Personal notes about the quiz',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateBookmarkDto {
  @ApiPropertyOptional({
    description: 'Updated personal notes',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListCollectionBookmarksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by difficulty',
    example: 'medium',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(DEFAULT_SLUG_PATTERN)
  difficulty?: string;
}
