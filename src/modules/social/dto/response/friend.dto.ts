import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FriendRequestDto {
  @ApiProperty({
    description: 'Friendship record identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  friendshipId!: string;

  @ApiProperty({
    description: 'User identifier of the person who sent the request',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  requesterId!: string;

  @ApiProperty({ description: 'Username of the requester', example: 'alice_wonder' })
  requesterUsername!: string;

  @ApiPropertyOptional({
    description: 'Display name of the requester',
    example: 'Alice',
    nullable: true,
  })
  requesterDisplayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL of the requester',
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  requesterAvatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the request was sent (ISO 8601)',
    example: '2025-06-01T10:00:00.000Z',
  })
  createdAt!: string;
}

export class FriendDto {
  @ApiProperty({
    description: 'Friendship record identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  friendshipId!: string;

  @ApiProperty({
    description: "The friend's user identifier",
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: "The friend's username", example: 'bob_builder' })
  username!: string;

  @ApiPropertyOptional({
    description: "The friend's display name",
    example: 'Bob',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: "The friend's avatar URL",
    format: 'uri',
    example: 'https://example.com/avatars/bob.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the friendship was established (ISO 8601)',
    example: '2025-05-15T08:00:00.000Z',
  })
  friendSince!: string;
}
