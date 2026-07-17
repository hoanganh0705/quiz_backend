import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RespondFriendRequestDto {
  @ApiProperty({
    description: 'Whether to accept the friend request',
    example: true,
  })
  @IsBoolean()
  accept!: boolean;
}
