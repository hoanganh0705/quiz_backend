import { ApiProperty } from '@nestjs/swagger';
import { ReviewResponseDto, ReviewPaginationResponseDto } from './review-response.dto';

export class ReviewListResponseDto {
  @ApiProperty({
    description: 'Review items',
    type: () => [ReviewResponseDto],
  })
  items!: ReviewResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => ReviewPaginationResponseDto,
  })
  pagination!: ReviewPaginationResponseDto;
}
