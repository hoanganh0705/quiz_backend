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
  isNew: boolean;
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
