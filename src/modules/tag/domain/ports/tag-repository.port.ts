export interface TagRow {
  tagId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagRowWithDeleted extends TagRow {
  deletedAt: string | null;
}

export interface TagFollowRow {
  followId: string;
  userId: string;
  tagId: string;
  createdAt: string;
}

export interface FollowedTagRow extends TagRow {
  followId: string;
  followedAt: string;
}

export interface RankedTagRow extends TagRow {
  rank: number;
  totalScore: string;
  totalAttempts: string;
}

export interface TagRepositoryPort {
  findById(tagId: string): Promise<TagRow | null>;
  findByIdIncludingDeleted(tagId: string): Promise<TagRowWithDeleted | null>;
  findBySlug(slug: string): Promise<TagRow | null>;
  findMany(params: {
    limit: number;
    cursor?: { createdAt: string; tagId: string } | null;
  }): Promise<TagRow[]>;
  findRelatedBySlug(params: { slug: string; limit: number }): Promise<TagRow[]>;
  create(params: { name: string; slug: string; nowIso: string }): Promise<TagRow>;
  update(params: {
    tagId: string;
    patch: { name?: string; slug?: string };
    nowIso: string;
  }): Promise<TagRow | null>;
  softDelete(tagId: string, nowIso: string): Promise<boolean>;
  restore(tagId: string, nowIso: string): Promise<TagRow | null>;
  followTag(params: { userId: string; tagId: string; nowIso: string }): Promise<TagFollowRow>;
  unfollowTag(params: { userId: string; tagId: string; nowIso: string }): Promise<void>;
  listFollowedTags(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedTagRow[]>;
  getPopularTags(limit: number): Promise<RankedTagRow[]>;
  getTrendingTags(limit: number): Promise<RankedTagRow[]>;
}

export const TAG_REPOSITORY_PORT = Symbol('TAG_REPOSITORY_PORT');
