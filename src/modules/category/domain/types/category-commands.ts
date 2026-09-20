import type { CategoryCursorPayload } from '../../types/category.types';
import type { CategorySortField, SortDirection } from '../ports/category-repository.port';

export type CategoryPatch = {
  name?: string;
  description?: string | null;
  slug?: string;
  imageUrl?: string | null;
};

export type CreateCategoryCommand = {
  name: string;
  description?: string | null;
  slug?: string;
  imageUrl?: string | null;
};

export type UpdateCategoryCommand = {
  name?: string;
  description?: string | null;
  slug?: string;
  imageUrl?: string | null;
};

export type CategorySort = {
  field: CategorySortField;
  direction: SortDirection;
};

export type ListCategoriesQuery = {
  cursor?: CategoryCursorPayload | null;
  limit?: number;
  sort?: CategorySort;
};

export type ListFollowedCategoriesQuery = {
  limit?: number;
  cursor?: { followedAt: string; followId: string } | null;
};

export type CategoryRankingQuery = {
  limit: number;
};

export type RelatedCategoriesQuery = {
  limit: number;
};
