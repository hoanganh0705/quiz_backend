import { ApiProperty } from '@nestjs/swagger';

/**
 * Generic message response DTO for action endpoints that return confirmation messages.
 */
export class MessageResponseDto {
  @ApiProperty({ description: 'Operation result message', example: 'Operation completed successfully' })
  message!: string;
}

/**
 * @deprecated Use MessageResponseDto instead.
 */
export class MoveBookmarkResponseDto extends MessageResponseDto {
  constructor() {
    super();
    this.message = 'Bookmark moved successfully';
  }
}
