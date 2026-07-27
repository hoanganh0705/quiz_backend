import type { FollowedCategoryRow } from './category-repository.types';

export interface CategoryFollowRepositoryPort {
  follow(params: {
    userId: string;
    categoryId: string;
    nowIso: string;
  }): Promise<{ followId: string; userId: string; categoryId: string; createdAt: string }>;
  unfollow(params: { userId: string; categoryId: string; nowIso: string }): Promise<void>;
  /**
   * Find an active (non-soft-deleted) follow of a category by a user.
   * Returns `null` when no such follow exists.
   *
   * Used by `CategoryDomainService.unfollowCategory` to enforce the
   * existence precondition before mutating (audit issue:
   * silent-success DELETE). Mirrors the social module's
   * `findAcceptedFriendship` / `findActiveFollow` finders.
   */
  findActiveFollow(params: {
    userId: string;
    categoryId: string;
  }): Promise<{ followId: string; userId: string; categoryId: string; createdAt: string } | null>;
  listFollowedCategories(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedCategoryRow[]>;
}

export type { FollowedCategoryRow };
export const CATEGORY_FOLLOW_REPOSITORY_PORT = Symbol('CATEGORY_FOLLOW_REPOSITORY_PORT');
