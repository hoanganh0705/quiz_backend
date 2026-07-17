import type { TagRow, RankedTagRow } from './tag-repository.types';

export interface TagRankingRepositoryPort {
  findRelatedBySlug(params: { slug: string; limit: number }): Promise<TagRow[]>;
  getPopularTags(limit: number): Promise<RankedTagRow[]>;
  getTrendingTags(limit: number): Promise<RankedTagRow[]>;
}

export type { TagRow, RankedTagRow };
export const TAG_RANKING_REPOSITORY_PORT = Symbol('TAG_RANKING_REPOSITORY_PORT');
