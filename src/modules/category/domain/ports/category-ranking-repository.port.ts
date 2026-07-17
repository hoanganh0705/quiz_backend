import type { CategoryRow, RankedCategoryRow } from './category-repository.types';

export interface CategoryRankingRepositoryPort {
  findRelatedBySlug(params: { slug: string; limit: number }): Promise<CategoryRow[]>;
  getPopularCategories(limit: number): Promise<RankedCategoryRow[]>;
  getTrendingCategories(limit: number): Promise<RankedCategoryRow[]>;
}

export type { CategoryRow, RankedCategoryRow };
export const CATEGORY_RANKING_REPOSITORY_PORT = Symbol('CATEGORY_RANKING_REPOSITORY_PORT');
