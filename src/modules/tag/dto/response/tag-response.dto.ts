import { ApiProperty } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({
    description: 'Unique tag identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag name', example: 'JavaScript' })
  name!: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'javascript' })
  slug!: string;

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
