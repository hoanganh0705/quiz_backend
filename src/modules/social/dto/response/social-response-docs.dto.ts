import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  UserFollowerItemDto,
  UserFollowingItemDto,
  SocialSuggestionItemDto,
  MutualFriendItemDto,
  MutualFollowerItemDto,
  SocialFeedItemDto,
  UserActivityItemDto,
  SocialCountsDto,
  UserSocialStatsResponseDto,
  MySocialAnalyticsResponseDto,
  TrendingUserResponseDto,
  RelationshipStatusDto,
  BlockedUserDto,
  SearchableUserDto,
  FriendLeaderboardDto,
  FriendDto,
  FollowerDto,
  FollowingDto,
  FriendRequestDto,
} from './social-response.dto';

// ─── Social module documentation-only wrapper DTOs ─────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// These wrapper DTOs document the actual wrapped shape in the OpenAPI spec.
//

// ─── Meta types ────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class PaginationMetaDataDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
    example: null,
  })
  nextCursor!: string | null;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Cursor-based pagination metadata', type: PaginationMetaDataDto })
  pagination!: PaginationMetaDataDto;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class WrappedUsernameSuggestionsDto {
  @ApiProperty({
    description: 'Username suggestions matching the search prefix',
    type: String,
    isArray: true,
    example: ['anh', 'annguyen', 'andrew'],
  })
  data!: string[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedSearchUsersDto {
  @ApiProperty({
    description: 'Searchable user results',
    type: () => [SearchableUserDto],
  })
  data!: SearchableUserDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedTrendingUsersDto {
  @ApiProperty({
    description: 'Trending user items',
    type: () => [TrendingUserResponseDto],
  })
  data!: TrendingUserResponseDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedFriendLeaderboardDto {
  @ApiProperty({
    description: 'Friend leaderboard',
    type: () => FriendLeaderboardDto,
  })
  data!: FriendLeaderboardDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedFriendRequestsDto {
  @ApiProperty({
    description: 'Friend request items',
    type: () => [FriendRequestDto],
  })
  data!: FriendRequestDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMessageDto {
  @ApiProperty({ description: 'Confirmation message', example: 'Friend request accepted' })
  message!: string;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedFriendsDto {
  @ApiProperty({
    description: 'Friend items',
    type: () => [FriendDto],
  })
  data!: FriendDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedFollowersDto {
  @ApiProperty({
    description: 'Follower items',
    type: () => [FollowerDto],
  })
  data!: FollowerDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedFollowingDto {
  @ApiProperty({
    description: 'Following items',
    type: () => [FollowingDto],
  })
  data!: FollowingDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUserFollowersDto {
  @ApiProperty({
    description: 'User follower items',
    type: () => [UserFollowerItemDto],
  })
  data!: UserFollowerItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUserFollowingDto {
  @ApiProperty({
    description: 'User following items',
    type: () => [UserFollowingItemDto],
  })
  data!: UserFollowingItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMutualFriendsDto {
  @ApiProperty({
    description: 'Mutual friend items',
    type: () => [MutualFriendItemDto],
  })
  data!: MutualFriendItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedMutualFollowersDto {
  @ApiProperty({
    description: 'Mutual follower items',
    type: () => [MutualFollowerItemDto],
  })
  data!: MutualFollowerItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedSocialSuggestionsDto {
  @ApiProperty({
    description: 'Suggested user items',
    type: () => [SocialSuggestionItemDto],
  })
  data!: SocialSuggestionItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedSocialFeedDto {
  @ApiProperty({
    description: 'Social feed activity items',
    type: () => [SocialFeedItemDto],
  })
  data!: SocialFeedItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUserActivityDto {
  @ApiProperty({
    description: 'User activity items',
    type: () => [UserActivityItemDto],
  })
  data!: UserActivityItemDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedRelationshipStatusDto {
  @ApiProperty({
    description: 'Relationship status between the authenticated user and the target user',
    type: () => RelationshipStatusDto,
  })
  data!: RelationshipStatusDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedSocialCountsDto {
  @ApiProperty({
    description: 'Social counts for the authenticated user',
    type: () => SocialCountsDto,
  })
  data!: SocialCountsDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedUserSocialStatsDto {
  @ApiProperty({
    description: 'Public social statistics for the target user',
    type: () => UserSocialStatsResponseDto,
  })
  data!: UserSocialStatsResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMySocialAnalyticsDto {
  @ApiProperty({
    description: 'Authenticated user social analytics',
    type: () => MySocialAnalyticsResponseDto,
  })
  data!: MySocialAnalyticsResponseDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedBlockedUsersDto {
  @ApiProperty({
    description: 'Blocked user items',
    type: () => [BlockedUserDto],
  })
  data!: BlockedUserDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}
