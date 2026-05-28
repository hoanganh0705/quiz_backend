import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';

export class CategoryPaginationResponseDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

export class CategoryListResponseDto {
  @ApiProperty({ description: 'Category items', type: () => [CategoryResponseDto] })
  items!: CategoryResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => CategoryPaginationResponseDto })
  pagination!: CategoryPaginationResponseDto;
}
