export interface CategoryRow {
  categoryId: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRowWithDeleted extends CategoryRow {
  deletedAt: string | null;
}

export interface CategoryFollowRow {
  followId: string;
  userId: string;
  categoryId: string;
  createdAt: string;
}

export interface CategoryRepositoryPort {
  findById(categoryId: string): Promise<CategoryRow | null>;
  findByIdIncludingDeleted(categoryId: string): Promise<CategoryRowWithDeleted | null>;
  findBySlug(slug: string): Promise<CategoryRow | null>;
  findMany(params: {
    limit: number;
    cursor?: { createdAt: string; categoryId: string } | null;
  }): Promise<CategoryRow[]>;
  findRelatedBySlug(params: { slug: string; limit: number }): Promise<CategoryRow[]>;
  create(params: {
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    nowIso: string;
  }): Promise<CategoryRow>;
  update(params: {
    categoryId: string;
    patch: {
      name?: string;
      description?: string | null;
      slug?: string;
      imageUrl?: string | null;
    };
    nowIso: string;
  }): Promise<CategoryRow | null>;
  softDelete(categoryId: string, nowIso: string): Promise<boolean>;
  restore(categoryId: string, nowIso: string): Promise<CategoryRow | null>;
  followCategory(params: {
    userId: string;
    categoryId: string;
    nowIso: string;
  }): Promise<CategoryFollowRow>;
  unfollowCategory(params: { userId: string; categoryId: string; nowIso: string }): Promise<void>;
  listFollowedCategories(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedCategoryRow[]>;
  getPopularCategories(limit: number): Promise<RankedCategoryRow[]>;
  getTrendingCategories(limit: number): Promise<RankedCategoryRow[]>;
}

export interface FollowedCategoryRow extends CategoryRow {
  followId: string;
  followedAt: string;
}

export interface RankedCategoryRow extends CategoryRow {
  rank: number;
  totalScore: string;
  totalAttempts: string;
}

export const CATEGORY_REPOSITORY_PORT = Symbol('CATEGORY_REPOSITORY_PORT');
