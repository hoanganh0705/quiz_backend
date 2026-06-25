import { ApiProperty } from '@nestjs/swagger';

export class BulkAddBookmarksResponseDto {
  @ApiProperty({
    description: 'Number of bookmarks newly added to the collection',
    example: 2,
  })
  addedCount!: number;
}

export class BulkRemoveBookmarksResponseDto {
  @ApiProperty({
    description: 'Number of bookmarks removed from the collection',
    example: 2,
  })
  removedCount!: number;
}
