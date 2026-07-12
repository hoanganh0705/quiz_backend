import type { RankedCategoryRow } from '../domain/ports/category-repository.port';
import type { RankedCategoryResponseDto } from '../dto/response/ranked-category-response.dto';

/**
 * Project a {@link RankedCategoryRow} (the persistence-layer shape) to the
 * public {@link RankedCategoryResponseDto}. Drops `createdAt` and `updatedAt`,
 * which are internal audit fields not exposed on the read API.
 */
export class RankedCategoryResponseMapper {
  static toResponse(row: RankedCategoryRow): RankedCategoryResponseDto {
    return {
      rank: row.rank,
      categoryId: row.categoryId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      totalScore: row.totalScore,
      totalAttempts: row.totalAttempts,
    };
  }
}
