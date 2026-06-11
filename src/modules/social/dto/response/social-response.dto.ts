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

export class UserFollowersPaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Number of items requested per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of followers', example: 120 })
  total!: number;
}

export class UserFollowerItemDto {
  @ApiProperty({
    description: "The follower's user identifier",
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: "The follower's username", example: 'charlie_chap' })
  username!: string;

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

export class UserFollowersResponseDto {
  @ApiProperty({ description: 'Follower items', type: () => [UserFollowerItemDto] })
  items!: UserFollowerItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class UserFollowingItemDto {
  @ApiProperty({
    description: 'User identifier of the person being followed',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username of the person being followed', example: 'diana_prince' })
  username!: string;

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

export class UserFollowingResponseDto {
  @ApiProperty({ description: 'Following items', type: () => [UserFollowingItemDto] })
  items!: UserFollowingItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class SocialSuggestionItemDto {
  @ApiProperty({
    description: 'Suggested user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Suggested username', example: 'anh_dev' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Suggested user avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/anh.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  mutualFriends!: number;

  @ApiProperty({ description: 'Number of mutual followers', example: 8 })
  mutualFollowers!: number;

  @ApiProperty({
    description: 'Human-readable primary suggestion reason',
    example: '12 mutual friends',
  })
  reason!: string;
}

export class SocialSuggestionsResponseDto {
  @ApiProperty({ description: 'Suggested users', type: () => [SocialSuggestionItemDto] })
  items!: SocialSuggestionItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class MutualFriendItemDto {
  @ApiProperty({
    description: 'Mutual friend user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Mutual friend username', example: 'mike_ross' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Mutual friend avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/mike.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class MutualFriendsResponseDto {
  @ApiProperty({ description: 'Mutual friend items', type: () => [MutualFriendItemDto] })
  items!: MutualFriendItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class MutualFollowerItemDto {
  @ApiProperty({
    description: 'Mutual follower user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Mutual follower username', example: 'user_b' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Mutual follower avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/user-b.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class MutualFollowersResponseDto {
  @ApiProperty({ description: 'Mutual follower items', type: () => [MutualFollowerItemDto] })
  items!: MutualFollowerItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class SocialFeedUserDto {
  @ApiProperty({
    description: 'User identifier for the activity actor',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username for the activity actor', example: 'anh_dev' })
  username!: string;
}

export class SocialFeedItemDto {
  @ApiProperty({
    description: 'Feed activity identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Feed activity type',
    enum: [
      'badge_earned',
      'badge_revoked',
      'rank_milestone',
      'peak_rank_achieved',
      'tournament_joined',
      'tournament_completed',
      'tournament_won',
      'discussion_created',
      'discussion_solved',
    ],
    example: 'badge_earned',
  })
  type!:
    | 'badge_earned'
    | 'badge_revoked'
    | 'rank_milestone'
    | 'peak_rank_achieved'
    | 'tournament_joined'
    | 'tournament_completed'
    | 'tournament_won'
    | 'discussion_created'
    | 'discussion_solved';

  @ApiProperty({
    description: 'Timestamp when the activity occurred (ISO 8601)',
    example: '2026-06-09T10:00:00.000Z',
  })
  occurredAt!: string;

  @ApiProperty({ description: 'Actor who produced the activity', type: () => SocialFeedUserDto })
  user!: SocialFeedUserDto;

  @ApiProperty({
    description: 'Type-specific activity payload',
    example: { badgeId: 'top_10', badgeName: 'Top 10' },
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;
}

export class SocialFeedResponseDto {
  @ApiProperty({ description: 'Feed items', type: () => [SocialFeedItemDto] })
  items!: SocialFeedItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class UserActivityItemDto {
  @ApiProperty({
    description: 'User activity type',
    enum: [
      'badge_earned',
      'badge_revoked',
      'rank_milestone',
      'peak_rank_achieved',
      'tournament_joined',
      'tournament_completed',
      'tournament_won',
      'discussion_created',
      'discussion_solved',
    ],
    example: 'badge_earned',
  })
  type!:
    | 'badge_earned'
    | 'badge_revoked'
    | 'rank_milestone'
    | 'peak_rank_achieved'
    | 'tournament_joined'
    | 'tournament_completed'
    | 'tournament_won'
    | 'discussion_created'
    | 'discussion_solved';

  @ApiProperty({
    description: 'Timestamp when the activity occurred (ISO 8601)',
    example: '2026-06-08T12:00:00.000Z',
  })
  occurredAt!: string;

  @ApiProperty({
    description: 'Type-specific public activity payload',
    example: { badgeName: 'Top 100' },
    additionalProperties: true,
  })
  payload!: Record<string, unknown>;
}

export class UserActivityResponseDto {
  @ApiProperty({ description: 'User activity items', type: () => [UserActivityItemDto] })
  items!: UserActivityItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class SocialCountsDto {
  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  friendCount!: number;

  @ApiProperty({ description: 'Number of followers', example: 34 })
  followerCount!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 28 })
  followingCount!: number;
}

export class UserSocialStatsResponseDto {
  @ApiProperty({ description: 'Number of accepted friendships', example: 120 })
  friends!: number;

  @ApiProperty({ description: 'Number of followers', example: 450 })
  followers!: number;

  @ApiProperty({ description: 'Number of accounts the user is following', example: 78 })
  following!: number;
}

export class MySocialAnalyticsResponseDto {
  @ApiProperty({ description: 'Current accepted friendship count', example: 42 })
  friends!: number;

  @ApiProperty({ description: 'Current follower count', example: 120 })
  followers!: number;

  @ApiProperty({ description: 'Current following count', example: 88 })
  following!: number;

  @ApiProperty({ description: 'Net follower growth over the last 30 days', example: 12 })
  growth30Days!: number;
}

export class TrendingUserResponseDto {
  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'Anh' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/anh.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Current follower count', example: 1250 })
  followers!: number;

  @ApiProperty({ description: 'Weighted trending score', example: 842 })
  trendScore!: number;

  @ApiProperty({
    description: 'Primary reason why this user is trending',
    enum: ['most_followed', 'fastest_growing', 'most_active', 'rising_star'],
    example: 'fastest_growing',
  })
  trendReason!: 'most_followed' | 'fastest_growing' | 'most_active' | 'rising_star';
}

export class TrendingUsersListResponseDto {
  @ApiProperty({ description: 'Trending users', type: () => [TrendingUserResponseDto] })
  items!: TrendingUserResponseDto[];
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
