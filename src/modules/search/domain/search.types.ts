export type SearchUserResult = {
  userId: string;
  username: string;
  displayName: string | null;
};

export type SearchQuizResult = {
  quizId: string;
  title: string;
  slug: string;
};

export type SearchCommentResult = {
  commentId: string;
  quizId: string;
};

export type SearchCategoryResult = {
  categoryId: string;
  name: string;
  slug: string | null;
};

export type SearchTagResult = {
  tagId: string;
  name: string;
};

/**
 * Phase 1 (S-4): rename `commentss` → `comments`. The previous
 * spelling was a typo in `SearchResponseDto` that propagated into
 * `GlobalSearchResult`. The rename lands both at once so consumers
 * cannot read a hybrid shape (`commentss` from the application
 * service, `comments` from the wire DTO).
 */
export type GlobalSearchResult = {
  query: string;
  /**
   * Per-section `limit` echo — matches the input `limit` query
   * param (default `10`, max `20`). Search is cursor-less today;
   * `nextCursor` is always `null` and `hasNextPage` is always
   * `false`. The fields are reserved for forward compat.
   */
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
  users: SearchUserResult[];
  quizzes: SearchQuizResult[];
  comments: SearchCommentResult[];
  categories: SearchCategoryResult[];
  tags: SearchTagResult[];
};
