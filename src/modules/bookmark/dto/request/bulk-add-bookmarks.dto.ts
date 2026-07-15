import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class BulkAddBookmarksDto {
  @ApiProperty({
    description: 'List of quiz UUIDs to add to the collection. Maximum 100 items.',
    type: 'array',
    items: {
      type: 'string',
      format: 'uuid',
      example: '660e8400-e29b-41d4-a716-446655440000',
    },
    maxItems: 100,
    example: ['660e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
  })
  @Type(() => String)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  quizIds!: string[];
}
