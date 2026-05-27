import type { TagRow } from '../domain/ports/tag-repository.port';
import type { TagResponseDto } from '../dto/response/tag-response.dto';

export class TagResponseMapper {
  static toResponse(row: TagRow): TagResponseDto {
    return {
      tagId: row.tagId,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
