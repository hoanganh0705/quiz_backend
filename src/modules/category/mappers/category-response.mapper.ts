import type { CategoryRow } from '../domain/ports/category-repository.port';
import type { CategoryResponseDto } from '../dto/response/category-response.dto';

export class CategoryResponseMapper {
  static toResponse(row: CategoryRow): CategoryResponseDto {
    return {
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      slug: row.slug,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
