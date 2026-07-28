import { ApiProperty } from '@nestjs/swagger';

export class QuizStatsResponseDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Total number of attempts recorded for this quiz', example: 1240 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Number of distinct users who attempted this quiz', example: 830 })
  uniquePlayers!: number;

  @ApiProperty({ description: 'Average score percent across all attempts', example: 78.4 })
  averageScore!: number;

  @ApiProperty({
    description: 'Average review rating across all reviews (0–5 scale)',
    example: 4.6,
  })
  averageRating!: number;

  @ApiProperty({ description: 'Number of users who bookmarked this quiz', example: 95 })
  bookmarkCount!: number;

  @ApiProperty({
    description: 'Percentage of started attempts that reached completion',
    example: 86.5,
  })
  completionRate!: number;

  @ApiProperty({ description: 'Computed long-term popularity score', example: 91.2743 })
  popularityScore!: number;

  @ApiProperty({ description: 'Computed short-term trending score', example: 43.1182 })
  trendingScore!: number;
}
