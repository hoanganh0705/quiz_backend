export interface BookmarkCollectionAnalytics {
  collectionId: string;
  collectionName: string;
  summary: {
    totalBookmarks: number;
    totalQuizzes: number;
    averageQuizRating: number;
    uniqueCategories: number;
    uniqueTags: number;
  };
  topCategories: Array<{
    categoryId: string;
    name: string;
    slug: string;
    bookmarkCount: number;
  }>;
  topTags: Array<{
    tagId: string;
    name: string;
    slug: string;
    bookmarkCount: number;
  }>;
  lastUpdated: string;
}
