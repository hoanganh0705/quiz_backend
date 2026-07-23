import type {
  Friendship,
  FriendRequest,
  Friend,
  PaginatedMutualFriendsResult,
  RespondToFriendRequestParams,
} from '../../domain/types/social.types';

export const FRIENDSHIP_REPOSITORY_PORT = Symbol('FRIENDSHIP_REPOSITORY_PORT');

export interface FriendshipRepositoryPort {
  createFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;

  getFriendRequest(friendshipId: string): Promise<Friendship | null>;

  getPendingRequests(addresseeId: string): Promise<FriendRequest[]>;

  getSentRequests(requesterId: string): Promise<FriendRequest[]>;

  respondToFriendRequest(params: RespondToFriendRequestParams, requesterId: string): Promise<void>;

  getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]>;

  getFriendCount(userId: string): Promise<number>;

  removeFriend(userId: string, friendId: string): Promise<void>;

  getMutualFriends(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFriendsResult>;
}
