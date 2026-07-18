import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCollectionResponseDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({ description: 'Collection description', type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-02T08:00:00.000Z',
  })
  updatedAt!: string;
}

export class DeleteCollectionResponseDto {
  @ApiProperty({ description: 'Deletion confirmation', example: 'Collection deleted successfully' })
  message!: string;
}
