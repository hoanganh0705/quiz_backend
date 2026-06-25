import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RankedCategoryResponseDto {
  @ApiProperty({ description: '1-based rank position' })
  rank!: number;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'Aggregated popularity or trending score (numeric string)' })
  totalScore!: string;

  @ApiProperty({ description: 'Total quiz attempts across linked active quizzes (numeric string)' })
  totalAttempts!: string;
}
