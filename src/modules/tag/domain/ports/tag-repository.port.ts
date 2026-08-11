import type { TagRow, TagDeleteStatus } from './tag-repository.types';

export interface TagRepositoryPort {
  findById(tagId: string): Promise<TagRow | null>;
  findByIdIncludingDeleted(tagId: string): Promise<TagDeleteStatus | null>;
  findBySlug(slug: string): Promise<TagRow | null>;
  /**
   * Phase 2 (S-13): batched lookup keyed by slug. The frontend's
   * `useTagSlugsResolver` hook uses this to resolve user-supplied
   * tag slugs (typed in the filter chips) into tag IDs in a single
   * round-trip. Soft-deleted tags are filtered out at the query
   * layer so deleted tags do not show up as ghost filters.
   *
   * Returns the matching rows in the order they were found in
   * the database, not the order of `slugs`. Callers that need
   * a specific order should re-sort on the client side.
   */
  findBySlugs(slugs: string[]): Promise<TagRow[]>;
  findMany(params: {
    limit: number;
    cursor?: { createdAt: string; tagId: string } | null;
  }): Promise<TagRow[]>;
  create(params: { name: string; slug: string; nowIso: string }): Promise<TagRow>;
  update(params: {
    tagId: string;
    patch: { name?: string; slug?: string };
    nowIso: string;
  }): Promise<TagRow | null>;
  softDelete(tagId: string, nowIso: string): Promise<boolean>;
  restore(tagId: string, nowIso: string): Promise<TagRow | null>;
}

export type { TagRow, TagDeleteStatus };
export const TAG_REPOSITORY_PORT = Symbol('TAG_REPOSITORY_PORT');
