import { ApiProperty } from '@nestjs/swagger';

export class ReviewRatingDistributionDto {
  @ApiProperty({ description: 'Number of 1-star reviews', example: 12 })
  '1'!: number;

  @ApiProperty({ description: 'Number of 2-star reviews', example: 20 })
  '2'!: number;

  @ApiProperty({ description: 'Number of 3-star reviews', example: 55 })
  '3'!: number;

  @ApiProperty({ description: 'Number of 4-star reviews', example: 300 })
  '4'!: number;

  @ApiProperty({ description: 'Number of 5-star reviews', example: 863 })
  '5'!: number;
}

export class ReviewStatsResponseDto {
  @ApiProperty({ description: 'Average rating for the quiz', example: 4.3 })
  averageRating!: number;

  @ApiProperty({ description: 'Total number of reviews for the quiz', example: 1250 })
  totalReviews!: number;

  @ApiProperty({
    description: 'Distribution of reviews by star rating',
    type: () => ReviewRatingDistributionDto,
  })
  ratingDistribution!: ReviewRatingDistributionDto;
}
