import type { FollowedTagRow } from '../domain/ports/tag-repository.port';
import type { FollowedTagItemDto } from '../dto/response/parity-response.dto';

export class FollowedTagResponseMapper {
  static toItem(row: FollowedTagRow): FollowedTagItemDto {
    return {
      tagId: row.tagId,
      name: row.name,
      slug: row.slug,
      followedAt: row.followedAt,
    };
  }
}
