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

export class FollowerDto {
  @ApiProperty({
    description: 'Follow record identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  followId!: string;

  @ApiProperty({
    description: "The follower's user identifier",
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
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
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  followId!: string;

  @ApiProperty({
    description: 'User identifier of the person being followed',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
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

export class SocialCountsDto {
  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  friendCount!: number;

  @ApiProperty({ description: 'Number of followers', example: 34 })
  followerCount!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 28 })
  followingCount!: number;
}

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

export class BlockedUserDto {
  @ApiProperty({
    description: 'Identifier of the blocked user',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  blockedId!: string;

  @ApiPropertyOptional({
    description: 'Reason provided when blocking',
    example: 'Harassment',
    nullable: true,
  })
  reason!: string | null;
}

export class SearchableUserDto {
  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
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

export class FriendRankingEntryDto {
  @ApiProperty({ description: 'Rank position among friends', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
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

  @ApiProperty({ description: 'XP earned in this period', example: 1500 })
  xp!: number;

  @ApiProperty({
    description: 'Timestamp when friendship was established (ISO 8601)',
    example: '2025-05-15T08:00:00.000Z',
  })
  friendSince!: string;
}

export class FriendLeaderboardDto {
  @ApiProperty({
    description: 'Leaderboard period',
    enum: ['weekly', 'monthly', 'all_time'],
    example: 'weekly',
  })
  period!: 'weekly' | 'monthly' | 'all_time';

  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [FriendRankingEntryDto],
  })
  entries!: FriendRankingEntryDto[];

  @ApiPropertyOptional({
    description: "The current user's rank among friends (null if not ranked)",
    example: 3,
    nullable: true,
  })
  currentUserRank!: number | null;

  @ApiProperty({ description: 'Total number of participating friends', example: 12 })
  totalParticipants!: number;
}
