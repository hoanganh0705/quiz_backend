import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCollectionResponseDto {
  @ApiProperty({
    description: 'New collection identifier',
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
}
