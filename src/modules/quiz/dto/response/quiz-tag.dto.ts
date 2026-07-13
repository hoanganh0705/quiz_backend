import { ApiProperty } from '@nestjs/swagger';

export class QuizTagDto {
  @ApiProperty({
    description: 'Unique tag identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag display name',
    example: 'Physics',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'physics',
  })
  slug!: string;
}
