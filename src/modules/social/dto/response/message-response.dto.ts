import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ description: 'Human-readable confirmation message', example: 'User blocked' })
  message!: string;
}
