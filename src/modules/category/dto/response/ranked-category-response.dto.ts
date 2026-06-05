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

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'Aggregated popularity or trending score (numeric string)' })
  totalScore!: string;

  @ApiProperty({ description: 'Total quiz attempts across linked active quizzes (numeric string)' })
  totalAttempts!: string;
}
