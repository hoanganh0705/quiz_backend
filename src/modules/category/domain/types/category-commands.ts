import type { CategoryCursorPayload } from '../../types/category.types';

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
