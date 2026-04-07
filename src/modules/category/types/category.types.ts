export type CategoryPatch = {
  name?: string;
  description?: string | null;
  slug?: string;
  imageUrl?: string | null;
};

export type CategoryCursorPayload = {
  createdAt: string;
  categoryId: string;
};

export type ListCategoriesCursorQuery = {
  cursor?: string;
  limit?: number;
};
