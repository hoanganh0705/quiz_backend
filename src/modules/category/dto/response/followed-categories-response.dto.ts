import { ApiProperty } from '@nestjs/swagger';
import { CategoryPaginationResponseDto } from './category-list-response.dto';
import { FollowedCategoryItemDto } from './followed-category-item.dto';

export class FollowedCategoriesResponseDto {
  @ApiProperty({
    description: 'Categories the authenticated user follows, ordered by most recently followed',
    type: [FollowedCategoryItemDto],
  })
  items!: FollowedCategoryItemDto[];

  @ApiProperty({ description: 'Cursor pagination metadata', type: CategoryPaginationResponseDto })
  pagination!: CategoryPaginationResponseDto;
}
