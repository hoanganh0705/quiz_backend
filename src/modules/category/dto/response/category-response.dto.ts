import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Unique category identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'General Knowledge' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Test your knowledge across topics',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ description: 'URL-friendly slug', example: 'general-knowledge' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Category cover image URL', format: 'uri', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}
