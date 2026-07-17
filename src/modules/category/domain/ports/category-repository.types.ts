export interface CategoryRow {
  categoryId: string;
  name: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRowWithDeleted extends CategoryRow {
  deletedAt: string | null;
}

export interface CategoryFollowRow {
  followId: string;
  userId: string;
  categoryId: string;
  createdAt: string;
}

export interface FollowedCategoryRow extends CategoryRow {
  followId: string;
  followedAt: string;
}

export interface RankedCategoryRow extends CategoryRow {
  rank: number;
  totalScore: string;
  totalAttempts: string;
}
