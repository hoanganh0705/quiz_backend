import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsEnum, Max, Min } from 'class-validator';
import { ReviewSort } from '@/modules/review/domain/ports';

export class ListReviewsQueryDto {
  @ApiPropertyOptional({
    description:
      'Cursor for cursor-based pagination. Pass the `nextCursor` from a previous response.',
    type: String,
    example:
      'eyJjcmVhdGVkQXQiOiAiMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaIiwgInJldmlld0lkIjogIjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of reviews to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter reviews by rating (1–5 stars)',
    type: Number,
    minimum: 1,
    maximum: 5,
    nullable: true,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'Sort order for the review list',
    enum: ReviewSort,
    default: ReviewSort.NEWEST,
    example: 'newest',
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ReviewSort)
  sort?: ReviewSort = ReviewSort.NEWEST;
}
