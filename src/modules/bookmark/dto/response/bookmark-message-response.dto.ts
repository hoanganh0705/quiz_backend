import { ApiProperty } from '@nestjs/swagger';

/**
 * Generic message response DTO for action endpoints that return confirmation messages.
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Operation result message',
    example: 'Operation completed successfully',
  })
  message!: string;
}
