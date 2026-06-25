import { ApiProperty } from '@nestjs/swagger';

export class RelationshipStatusDto {
  @ApiProperty({ description: 'Whether the viewed user is a mutual friend', example: false })
  isFriend!: boolean;

  @ApiProperty({
    description: 'Whether there is a pending friend request between the two users',
    example: true,
  })
  hasPendingRequest!: boolean;

  @ApiProperty({ description: 'Whether the viewed user follows the current user', example: false })
  isFollower!: boolean;

  @ApiProperty({ description: 'Whether the current user follows the viewed user', example: true })
  isFollowing!: boolean;

  @ApiProperty({
    description: 'Whether the current user has blocked the viewed user',
    example: false,
  })
  isBlocked!: boolean;

  @ApiProperty({
    description: 'Whether the current user is blocked by the viewed user',
    example: false,
  })
  isBlockedBy!: boolean;
}
