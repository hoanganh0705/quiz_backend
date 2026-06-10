import type { CategoryCursorPayload } from '../../types/category.types';

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

export type ListCategoriesQuery = {
  cursor?: CategoryCursorPayload | null;
  limit?: number;
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
