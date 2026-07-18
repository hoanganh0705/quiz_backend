import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RankedCategoryResponseDto {
  @ApiProperty({ description: '1-based rank position' })
  rank!: number;

  @ApiProperty({ description: 'Category identifier', format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'Science' })
  name!: string;

  @ApiProperty({ description: 'Kebab-case category slug', example: 'science' })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Category cover image URL, or null when no cover is set',
    type: String,
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiPropertyOptional({
    description: 'Category description, or null when not set',
    type: String,
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ description: 'Aggregated popularity or trending score (numeric string)' })
  totalScore!: string;

  @ApiProperty({ description: 'Total quiz attempts across linked active quizzes (numeric string)' })
  totalAttempts!: string;
}
