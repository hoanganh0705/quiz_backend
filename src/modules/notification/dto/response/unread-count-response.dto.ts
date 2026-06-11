import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread notifications', example: 5 })
  count!: number;
}
