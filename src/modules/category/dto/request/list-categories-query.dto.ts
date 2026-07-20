import { Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const CATEGORY_SORT_OPTIONS = ['name', 'createdAt'] as const;
export type CategorySortOption = (typeof CATEGORY_SORT_OPTIONS)[number];

export const SORT_ORDER = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDER)[number];

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination (from previous response)',
    type: String,
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string | null;

  @ApiPropertyOptional({
    description: 'Maximum number of categories to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort categories by name or creation date',
    enum: CATEGORY_SORT_OPTIONS,
    default: 'name',
    example: 'name',
    nullable: true,
  })
  @IsOptional()
  @IsIn(CATEGORY_SORT_OPTIONS)
  sort?: CategorySortOption;

  @ApiPropertyOptional({
    description: 'Sort direction (ascending or descending)',
    enum: SORT_ORDER,
    default: 'asc',
    example: 'asc',
    nullable: true,
  })
  @IsOptional()
  @IsIn(SORT_ORDER)
  order?: SortOrder;
}
