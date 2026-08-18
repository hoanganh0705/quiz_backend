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

  /**
   * Mark a pending friend request as accepted or rejected. Filters
   * on `status='pending'` AND `isNull(deletedAt)` so a tombstoned
   * row cannot be flipped. Returns the row count so the caller can
   * detect the "already terminal" race.
   */
  respondToFriendRequest(
    params: RespondToFriendRequestParams,
    requesterId: string,
  ): Promise<number>;

  /**
   * Soft-delete a pending friend request by its `friendshipId`.
   * Returns the number of rows updated so the caller can distinguish
   * a successful cancel from a no-op (the request was already
   * accepted, rejected, or cancelled by another tab).
   */
  cancelFriendRequestById(friendshipId: string): Promise<number>;

  getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]>;

  getFriendCount(userId: string): Promise<number>;

  removeFriend(userId: string, friendId: string): Promise<void>;

  /**
   * Find an active (non-soft-deleted) accepted friendship between
   * two users. Returns `null` when no such friendship exists.
   *
   * Used by `SocialService.removeFriend` to enforce the existence
   * precondition before mutating (audit issue: silent-success
   * DELETE). The match is direction-agnostic — either side may
   * appear as `requesterId` or `addresseeId`.
   */
  findAcceptedFriendship(userId: string, friendId: string): Promise<Friendship | null>;

  getMutualFriends(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFriendsResult>;
}
