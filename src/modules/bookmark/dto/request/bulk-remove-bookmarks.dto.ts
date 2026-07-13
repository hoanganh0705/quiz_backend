import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class BulkRemoveBookmarksDto {
  @ApiProperty({
    description: 'List of quiz UUIDs to remove from the collection. Maximum 100 items.',
    type: [String],
    maxItems: 100,
    example: ['660e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
  })
  @Type(() => String)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  quizIds!: string[];
}
