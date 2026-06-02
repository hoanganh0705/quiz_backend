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
  createdAt: string;
}

export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
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

export interface SocialCounts {
  friendCount: number;
  followerCount: number;
  followingCount: number;
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

export interface UserSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

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
}

export interface FriendLeaderboard {
  period: 'weekly' | 'monthly' | 'all_time';
  entries: FriendRankingEntry[];
  currentUserRank: number | null;
  totalParticipants: number;
}
