import { ApiProperty } from '@nestjs/swagger';

export class DiscussionSavedThreadActionResponseDto {
  @ApiProperty({ description: 'Whether the operation completed successfully', example: true })
  success!: boolean;
}
