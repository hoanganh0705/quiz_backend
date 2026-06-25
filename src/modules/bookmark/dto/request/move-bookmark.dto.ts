import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MoveBookmarkDto {
  @ApiProperty({
    description: 'UUID of the quiz to move',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizId!: string;

  @ApiProperty({
    description: 'UUID of the destination collection',
    format: 'uuid',
    example: '770e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4')
  targetCollectionId!: string;
}
