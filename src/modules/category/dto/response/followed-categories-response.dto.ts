import { ApiProperty } from '@nestjs/swagger';
import { CategoryPaginationResponseDto } from './category-list-response.dto';
import { FollowedCategoryItemDto } from './followed-category-item.dto';

export class FollowedCategoriesResponseDto {
  @ApiProperty({ type: [FollowedCategoryItemDto] })
  items!: FollowedCategoryItemDto[];

  @ApiProperty({ type: CategoryPaginationResponseDto })
  pagination!: CategoryPaginationResponseDto;
}
