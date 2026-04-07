import { CategoryResponseDto } from './category-response.dto';

export class CategoryPaginationResponseDto {
  limit!: number;
  nextCursor!: string | null;
  hasNextPage!: boolean;
}

export class CategoryListResponseDto {
  items!: CategoryResponseDto[];
  pagination!: CategoryPaginationResponseDto;
}
