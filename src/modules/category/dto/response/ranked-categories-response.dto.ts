import { ApiProperty } from '@nestjs/swagger';
import { RankedCategoryResponseDto } from './ranked-category-response.dto';

export class RankedCategoriesResponseDto {
  @ApiProperty({
    description: 'Categories ranked by aggregated score',
    type: [RankedCategoryResponseDto],
  })
  items!: RankedCategoryResponseDto[];
}
