import type { BlockedUser } from '../../domain/types/social.types';

export const BLOCK_REPOSITORY_PORT = Symbol('BLOCK_REPOSITORY_PORT');

export interface BlockRepositoryPort {
  blockUser(blockerId: string, blockedId: string, reason?: string): Promise<BlockedUser>;

  unblockUser(blockerId: string, blockedId: string): Promise<void>;

  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;

  getBlockedUsers(blockerId: string): Promise<BlockedUser[]>;
}
