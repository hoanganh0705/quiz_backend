import type { FollowedCategoryRow } from './category-repository.types';

export interface CategoryFollowRepositoryPort {
  follow(params: {
    userId: string;
    categoryId: string;
    nowIso: string;
  }): Promise<{ followId: string; userId: string; categoryId: string; createdAt: string }>;
  unfollow(params: { userId: string; categoryId: string; nowIso: string }): Promise<void>;
  listFollowedCategories(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedCategoryRow[]>;
}

export type { FollowedCategoryRow };
export const CATEGORY_FOLLOW_REPOSITORY_PORT = Symbol('CATEGORY_FOLLOW_REPOSITORY_PORT');
