import { IsInt, IsOptional, IsString, Max, Min, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description: 'Optional written review',
    maxLength: 1000,
    example: 'Great quiz! Some questions were tricky but fair.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Max(1000)
  comment?: string | null;
}

export class UpdateReviewDto {
  @ApiProperty({
    description: 'Updated rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description: 'Updated review text',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Max(1000)
  comment?: string | null;
}

export class ListReviewsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    nullable: true,
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
    example: 5,
    minimum: 1,
    maximum: 5,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class ListMyReviewsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJyZXZpZXdJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–100)',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class HelpfulReviewDto {
  @ApiProperty({
    description: 'Whether the review should be marked as helpful',
    example: true,
  })
  @IsBoolean()
  helpful!: boolean;
}

export class ReportReviewDto {
  @ApiProperty({
    description: 'Reason for reporting the review',
    example: 'spam',
  })
  @IsString()
  @MaxLength(255)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional moderation details',
    example: 'Contains advertising links',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string | null;
}
