import { ApiProperty } from '@nestjs/swagger';

export class DiscussionSubscriptionActionResponseDto {
  @ApiProperty({ description: 'Whether the operation completed successfully', example: true })
  success!: boolean;
}
