export interface UserAnalytics {
  userId: string;
  summary: {
    totalAttempts: number;
    completedQuizzes: number;
    averageScore: number;
  };
  favoriteCategory: {
    categoryId: string;
    name: string;
  } | null;
  favoriteTag: {
    tagId: string;
    name: string;
  } | null;
  lastUpdated: string;
}
