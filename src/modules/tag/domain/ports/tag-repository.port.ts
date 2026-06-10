export interface TagRow {
  tagId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagDeleteStatus {
  deletedAt: string | null;
}

export interface FollowResult {
  followId: string;
}

export interface TagUnfollowResult {
  unfollowed: boolean;
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
  findByIdIncludingDeleted(tagId: string): Promise<TagDeleteStatus | null>;
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
  followTag(params: { userId: string; tagId: string; nowIso: string }): Promise<FollowResult>;
  unfollowTag(params: {
    userId: string;
    tagId: string;
    nowIso: string;
  }): Promise<TagUnfollowResult>;
  listFollowedTags(params: {
    userId: string;
    limit: number;
    cursor?: { followedAt: string; followId: string } | null;
  }): Promise<FollowedTagRow[]>;
  getPopularTags(limit: number): Promise<RankedTagRow[]>;
  getTrendingTags(limit: number): Promise<RankedTagRow[]>;
}

export const TAG_REPOSITORY_PORT = Symbol('TAG_REPOSITORY_PORT');
