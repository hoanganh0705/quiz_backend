import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';

export class RelatedCategoriesResponseDto {
  @ApiProperty({ description: 'Related category items', type: () => [CategoryResponseDto] })
  items!: CategoryResponseDto[];
}
