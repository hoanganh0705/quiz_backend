import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookmarkCollectionResponseDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({
    description: 'Owner user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Collection description',
    type: String,
    nullable: true,
    example: 'A curated set of frontend interview quizzes',
  })
  description!: string | null;

  @ApiProperty({
    description: 'Number of bookmarked quizzes in this collection',
    example: 5,
    minimum: 0,
  })
  quizCount!: number;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

/**
 * Wrapper for `GET /bookmarks/collections`.
 *
 * Unlike the search/recent endpoints, this response is intentionally a
 * **single-resource envelope** (`{ data: { items: [...] }, meta }`) rather
 * than a paginated envelope (`{ data: [...], meta: { pagination } }`).
 *
 * Rationale (Phase 7 M9 of the bookmark API contract audit):
 *   - The list is bounded by the number of collections the authenticated
 *     user owns (typically < 100), so cursor/offset pagination adds no value.
 *   - Returning every owned collection in one response keeps the frontend's
 *     "list of folders" UI trivially simple — no cursor stitching.
 *   - Keeping the same `{ items: T[] }` shape that the application service
 *     already produces avoids an unnecessary unwrap/rewrap in the presenter.
 *
 * If the collection count grows unboundedly in the future, switch this
 * envelope to `ApiOkResourceList(...)` and introduce a cursor query
 * parameter — at that point this DTO becomes the `data` of the response.
 */
export class BookmarkCollectionListResponseDto {
  @ApiProperty({
    description: 'Collections owned by the authenticated user',
    type: [BookmarkCollectionResponseDto],
  })
  items!: BookmarkCollectionResponseDto[];
}
