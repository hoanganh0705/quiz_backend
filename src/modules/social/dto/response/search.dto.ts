import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchableUserDto {
  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'Alice', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Whether this user is already a friend', example: false })
  isFriend!: boolean;

  @ApiProperty({
    description: 'Whether there is a pending friend request with this user',
    example: false,
  })
  hasPendingRequest!: boolean;

  @ApiProperty({ description: 'Whether this user is blocked', example: false })
  isBlocked!: boolean;
}
