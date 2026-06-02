export class FriendRequestDto {
  friendshipId: string;
  requesterId: string;
  requesterUsername: string;
  requesterDisplayName: string | null;
  requesterAvatarUrl: string | null;
  createdAt: string;
}

export class FriendDto {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  friendSince: string;
}

export class FollowerDto {
  followId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followedAt: string;
}

export class FollowingDto {
  followId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followedAt: string;
}

export class SocialCountsDto {
  friendCount: number;
  followerCount: number;
  followingCount: number;
}

export class RelationshipStatusDto {
  isFriend: boolean;
  hasPendingRequest: boolean;
  isFollower: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
}

export class BlockedUserDto {
  blockedId: string;
  reason: string | null;
}

export class SearchableUserDto {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isFriend: boolean;
  hasPendingRequest: boolean;
  isBlocked: boolean;
}

export class FriendRankingEntryDto {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  xp: number;
  friendSince: string;
}

export class FriendLeaderboardDto {
  period: 'weekly' | 'monthly' | 'all_time';
  entries: FriendRankingEntryDto[];
  currentUserRank: number | null;
  totalParticipants: number;
}
