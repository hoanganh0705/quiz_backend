import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FollowedCategoryItemDto } from './followed-category-item.dto';

class FollowedCategoriesPaginationDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
}

export class FollowedCategoriesResponseDto {
  @ApiProperty({ type: [FollowedCategoryItemDto] })
  items!: FollowedCategoryItemDto[];

  @ApiProperty({ type: FollowedCategoriesPaginationDto })
  pagination!: FollowedCategoriesPaginationDto;
}
