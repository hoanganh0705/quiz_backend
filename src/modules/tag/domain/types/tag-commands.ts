import type { TagCursorPayload } from '../../types/tag.types';

export type CreateTagCommand = {
  name: string;
  slug?: string;
};

export type UpdateTagCommand = {
  name?: string;
  slug?: string;
};

export type ListTagsQuery = {
  cursor?: TagCursorPayload | null;
  limit?: number;
};
