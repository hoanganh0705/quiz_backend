import { ApiProperty } from '@nestjs/swagger';

export class BookmarkStatusCollectionDto {
  @ApiProperty({
    description: 'Collection identifier containing the bookmarked quiz',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Favorites' })
  name!: string;
}

export class BookmarkStatusResponseDto {
  /**
   * `true` when the authenticated user has the quiz bookmarked in at least
   * one of their collections.
   *
   * **Runtime behavior (Phase 7 H7 of the bookmark API contract audit):**
   * this field is `false` (and `collections` is `[]`) both when the user has
   * not bookmarked the quiz **and** when the quiz itself does not exist.
   * `GET /bookmarks/quizzes/:quizId/status` never returns 404 — it always
   * answers 200 with a `{ bookmarked, collections }` shape. Clients should
   * rely on `bookmarked === false` rather than absence / 404 to drive UX.
   */
  @ApiProperty({
    description:
      'Whether the authenticated user has bookmarked the quiz in any collection. ' +
      '`false` when the quiz is not bookmarked or does not exist — this endpoint ' +
      'never returns 404; it always answers 200 with a `{ bookmarked, collections }` shape.',
    example: true,
  })
  bookmarked!: boolean;

  @ApiProperty({
    description: 'Collections owned by the authenticated user that contain the quiz',
    type: [BookmarkStatusCollectionDto],
    example: [
      {
        collectionId: '770e8400-e29b-71d4-a716-446655440000',
        name: 'Favorites',
      },
      {
        collectionId: '770e8400-e29b-71d4-a716-446655440001',
        name: 'React Learning',
      },
    ],
  })
  collections!: BookmarkStatusCollectionDto[];
}
