import { ApiProperty } from '@nestjs/swagger';
import { RankedCategoryResponseDto } from './ranked-category-response.dto';

export class RankedCategoriesResponseDto {
  @ApiProperty({ type: [RankedCategoryResponseDto] })
  items!: RankedCategoryResponseDto[];
}
