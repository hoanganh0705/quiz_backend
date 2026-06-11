import { ApiProperty } from '@nestjs/swagger';

export class DeletedReadNotificationsResponseDto {
  @ApiProperty({ description: 'Number of read notifications that were deleted', example: 3 })
  deletedCount!: number;
}
