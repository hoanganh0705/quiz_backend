import type { RankedTagRow } from '../domain/ports';
import type { RankedTagResponseDto } from '../dto/response/parity-response.dto';

/**
 * Project a {@link RankedTagRow} (the persistence-layer shape) to the public
 * {@link RankedTagResponseDto}. Drops `createdAt` and `updatedAt`, which are
 * internal audit fields not exposed on the read API. Mirrors the matching
 * mapper in the Category module for consistency.
 */
export class RankedTagResponseMapper {
  static toResponse(item: RankedTagRow): RankedTagResponseDto {
    return {
      rank: item.rank,
      tagId: item.tagId,
      name: item.name,
      slug: item.slug,
      totalScore: item.totalScore,
      totalAttempts: item.totalAttempts,
    };
  }
}
