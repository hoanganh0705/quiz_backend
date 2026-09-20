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

export type GlobalSearchResult = {
  query: string;
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
  users: SearchUserResult[];
  quizzes: SearchQuizResult[];
  comments: SearchCommentResult[];
  categories: SearchCategoryResult[];
  tags: SearchTagResult[];
};
