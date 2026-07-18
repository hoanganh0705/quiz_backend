import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowerDto {
  @ApiProperty({
    description: 'Follow record identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  followId!: string;

  @ApiProperty({
    description: "The follower's user identifier",
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: "The follower's username", example: 'charlie_chap' })
  username!: string;

  @ApiPropertyOptional({
    description: "The follower's display name",
    example: 'Charlie',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: "The follower's avatar URL",
    format: 'uri',
    example: 'https://example.com/avatars/charlie.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the follow occurred (ISO 8601)',
    example: '2025-05-20T09:00:00.000Z',
  })
  followedAt!: string;
}

export class FollowingDto {
  @ApiProperty({
    description: 'Follow record identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  followId!: string;

  @ApiProperty({
    description: 'User identifier of the person being followed',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username of the person being followed', example: 'diana_prince' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name of the person being followed',
    example: 'Diana',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL of the person being followed',
    format: 'uri',
    example: 'https://example.com/avatars/diana.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the follow occurred (ISO 8601)',
    example: '2025-05-20T09:00:00.000Z',
  })
  followedAt!: string;
}
