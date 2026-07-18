import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SolveThreadDto {
  @ApiProperty({
    description: 'Comment identifier to mark as the accepted solution',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  @IsUUID('7')
  commentId!: string;
}
