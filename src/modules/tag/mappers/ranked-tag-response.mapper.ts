import type { RankedTagRow } from '../domain/ports/tag-repository.port';
import type { RankedTagResponseDto } from '../dto/response/parity-response.dto';

export class RankedTagResponseMapper {
  static toResponse(item: RankedTagRow): RankedTagResponseDto {
    return {
      rank: item.rank,
      tagId: item.tagId,
      name: item.name,
      slug: item.slug,
      totalScore: item.totalScore,
      totalAttempts: item.totalAttempts,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
