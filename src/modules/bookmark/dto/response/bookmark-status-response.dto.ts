import { ApiProperty } from '@nestjs/swagger';

export class BookmarkStatusCollectionDto {
  @ApiProperty({
    description: 'Collection identifier containing the bookmarked quiz',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Favorites' })
  name!: string;
}

export class BookmarkStatusResponseDto {
  @ApiProperty({
    description: 'Whether the authenticated user has bookmarked the quiz in any collection',
    example: true,
  })
  bookmarked!: boolean;

  @ApiProperty({
    description: 'Collections owned by the authenticated user that contain the quiz',
    type: () => [BookmarkStatusCollectionDto],
    example: [
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440000',
        name: 'Favorites',
      },
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440001',
        name: 'React Learning',
      },
    ],
  })
  collections!: BookmarkStatusCollectionDto[];
}
