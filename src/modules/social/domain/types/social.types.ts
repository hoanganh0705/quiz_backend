import type { UserSearchResult } from '@/modules/user/domain/ports/user-search.port';

export interface Friendship {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface BlockedUser {
  blockId: string;
  blockerId: string;
  blockedId: string;
  reason: string | null;
  createdAt: string;
}

export interface UserFollow {
  followId: string;
  followerId: string;
  followingId: string;
  followerUsername: string;
  followingUsername: string;
  createdAt: string;
}

export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  requesterUsername: string;
  requesterDisplayName: string | null;
  requesterAvatarUrl: string | null;
  createdAt: string;
}

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  friendSince: string;
}

export interface Follower {
  followId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followedAt: string;
}

export interface Following {
  followId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followedAt: string;
}

export interface PaginatedFollowersResult {
  items: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    followedAt: string;
  }>;
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface PaginatedFollowingResult {
  items: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    followedAt: string;
  }>;
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface SocialSuggestion {
  userId: string;
  username: string;
  avatarUrl: string | null;
  mutualFriends: number;
  mutualFollowers: number;
  reason: string;
}

export interface PaginatedSocialSuggestionsResult {
  items: SocialSuggestion[];
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface PaginatedMutualFriendsResult {
  items: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
  }>;
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface PaginatedMutualFollowersResult {
  items: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
  }>;
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export type SocialFeedActivityType =
  | 'badge_earned'
  | 'badge_revoked'
  | 'rank_milestone'
  | 'peak_rank_achieved'
  | 'tournament_joined'
  | 'tournament_completed'
  | 'tournament_won'
  | 'comment_created'
  | 'comment_created'
  | 'comment_created'
  | 'quiz_completed'
  | 'quiz_milestone'
  | 'instance_created'
  | 'instance_joined'
  | 'instance_completed';

export interface SocialFeedActivity {
  id: string;
  type: SocialFeedActivityType;
  occurredAt: string;
  user: {
    userId: string;
    username: string;
  };
  payload: Record<string, unknown>;
}

export interface PaginatedSocialFeedResult {
  items: SocialFeedActivity[];
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface PaginatedUserActivityResult {
  items: Array<{
    id: string;
    type: SocialFeedActivityType;
    occurredAt: string;
    payload: Record<string, unknown>;
  }>;
  pagination: {
    kind: 'cursor';
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface SocialCounts {
  friendCount: number;
  followerCount: number;
  followingCount: number;
}

export interface UserSocialStats {
  friends: number;
  followers: number;
  following: number;
}

export interface MySocialAnalytics {
  friends: number;
  followers: number;
  following: number;
  growth30Days: number;
}

export type TrendingReason = 'most_followed' | 'fastest_growing' | 'most_active' | 'rising_star';

/** Rank trend summary for a single period (mirrors RankTrend from ranking.port). */
export interface RankTrendInfo {
  period: 'weekly' | 'monthly' | 'all_time';
  currentRank: number | null;
  previousRank: number | null;
  change: number;
  direction: 'up' | 'down' | 'stable' | 'new';
  currentXp: number;
  previousXp: number | null;
}

export interface TrendingUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  followers: number;
  trendScore: number;
  trendReason: TrendingReason;
  /** Current weekly rank trend from rank history snapshots */
  weeklyRankTrend: RankTrendInfo | null;
  /** Current monthly rank trend from rank history snapshots */
  monthlyRankTrend: RankTrendInfo | null;
}

export interface TrendingUsersResult {
  items: TrendingUser[];
}

export interface RelationshipStatus {
  isFriend: boolean;
  hasPendingRequest: boolean;
  isFollower: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
}

export interface CreateFriendRequestParams {
  addresseeId: string;
}

export interface RespondToFriendRequestParams {
  friendshipId: string;
  accept: boolean;
}

// Canonical type lives in UserModule; re-export here for convenience
export type { UserSearchResult } from '@/modules/user/domain/ports/user-search.port';

/**
 * Extend UserSearchResult with social relationship metadata.
 * Lives in SocialModule because it only makes sense in a social context.
 */
export interface SearchableUser extends UserSearchResult {
  isFriend: boolean;
  hasPendingRequest: boolean;
  isBlocked: boolean;
}

export interface FriendRankingEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  friendSince: string;
  /** Weekly rank trend from rank history snapshots */
  weeklyRankTrend: RankTrendInfo | null;
  /** Monthly rank trend from rank history snapshots */
  monthlyRankTrend: RankTrendInfo | null;
}

export interface FriendLeaderboard {
  period: 'weekly' | 'monthly' | 'all_time';
  entries: FriendRankingEntry[];
  currentUserRank: number | null;
  totalParticipants: number;
}
