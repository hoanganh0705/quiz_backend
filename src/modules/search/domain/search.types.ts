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

export type SearchDiscussionResult = {
  threadId: string;
  title: string;
};

export type GlobalSearchResult = {
  query: string;
  users: SearchUserResult[];
  quizzes: SearchQuizResult[];
  discussions: SearchDiscussionResult[];
};
