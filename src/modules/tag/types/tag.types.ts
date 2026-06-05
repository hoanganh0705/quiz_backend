export type TagPatch = {
  name?: string;
  slug?: string;
};

export type TagCursorPayload = {
  createdAt: string;
  tagId: string;
};

export type FollowedTagCursorPayload = {
  followedAt: string;
  followId: string;
};
