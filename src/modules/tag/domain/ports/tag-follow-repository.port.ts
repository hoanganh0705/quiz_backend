import type { FollowedTagRow, FollowResult, TagUnfollowResult } from './tag-repository.types';

export interface TagFollowRepositoryPort {
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
}

export type { FollowedTagRow, FollowResult, TagUnfollowResult };
export const TAG_FOLLOW_REPOSITORY_PORT = Symbol('TAG_FOLLOW_REPOSITORY_PORT');
