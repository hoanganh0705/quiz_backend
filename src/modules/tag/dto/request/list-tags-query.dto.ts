import { Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const TAG_SORT_OPTIONS = ['name', 'createdAt'] as const;
export type TagSortOption = (typeof TAG_SORT_OPTIONS)[number];

export const SORT_ORDER = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDER)[number];

export class ListTagsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    type: String,
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of tags to return per page',
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
    description: 'Sort tags by name or creation date',
    enum: TAG_SORT_OPTIONS,
    default: 'name',
    example: 'name',
    nullable: true,
  })
  @IsOptional()
  @IsIn(TAG_SORT_OPTIONS)
  sort?: TagSortOption;

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
