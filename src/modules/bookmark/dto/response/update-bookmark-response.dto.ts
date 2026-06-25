import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBookmarkResponseDto {
  @ApiProperty({ description: 'Bookmark record identifier', format: 'uuid' })
  bookmarkId!: string;

  @ApiProperty({ description: 'Collection identifier', format: 'uuid' })
  collectionId!: string;

  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiPropertyOptional({ description: 'Updated personal notes', type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Last update timestamp (ISO 8601)' })
  updatedAt!: string;
}
