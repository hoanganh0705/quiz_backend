import { ApiProperty } from '@nestjs/swagger';

export class QuizStatsResponseDto {
  @ApiProperty({ format: 'uuid' })
  quizId!: string;

  @ApiProperty({ example: 1240 })
  totalAttempts!: number;

  @ApiProperty({ example: 830 })
  totalPlayers!: number;

  @ApiProperty({ example: 78.4 })
  averageScore!: number;

  @ApiProperty({ example: 4.6 })
  averageRating!: number;

  @ApiProperty({ example: 95 })
  bookmarkCount!: number;

  @ApiProperty({ example: 86.5 })
  completionRate!: number;

  @ApiProperty({ example: 91.2743 })
  popularityScore!: number;

  @ApiProperty({ example: 43.1182 })
  trendingScore!: number;
}
