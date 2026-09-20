import type { CategoryRow, CategoryRowWithDeleted } from './category-repository.types';

export type CategorySortField = 'name' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export type CategorySortSpec = {
  field: CategorySortField;
  direction: SortDirection;
};

export interface CategoryRepositoryPort {
  findById(categoryId: string): Promise<CategoryRow | null>;
  findByIdIncludingDeleted(categoryId: string): Promise<CategoryRowWithDeleted | null>;
  findBySlug(slug: string): Promise<CategoryRow | null>;
  findMany(params: {
    limit: number;
    cursor?: { createdAt: string; categoryId: string } | null;
    sort?: CategorySortSpec;
  }): Promise<CategoryRow[]>;
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
}

export type { CategoryRow, CategoryRowWithDeleted };
export const CATEGORY_REPOSITORY_PORT = Symbol('CATEGORY_REPOSITORY_PORT');
