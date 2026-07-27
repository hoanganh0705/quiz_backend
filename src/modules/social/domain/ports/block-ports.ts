import type { BlockedUser } from '../../domain/types/social.types';

export const BLOCK_REPOSITORY_PORT = Symbol('BLOCK_REPOSITORY_PORT');

export interface BlockRepositoryPort {
  blockUser(blockerId: string, blockedId: string, reason?: string): Promise<BlockedUser>;

  unblockUser(blockerId: string, blockedId: string): Promise<void>;

  /**
   * Find an active (non-soft-deleted) block between two users.
   * Returns `null` when no such block exists.
   *
   * Used by `SocialService.unblockUser` to enforce the existence
   * precondition before mutating (audit issue: silent-success
   * DELETE). The match is direction-specific: `blockerId` must
   * match the caller's id (you cannot unblock a user that someone
   * else blocked).
   */
  findActiveBlock(blockerId: string, blockedId: string): Promise<BlockedUser | null>;

  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;

  getBlockedUsers(blockerId: string): Promise<BlockedUser[]>;
}
