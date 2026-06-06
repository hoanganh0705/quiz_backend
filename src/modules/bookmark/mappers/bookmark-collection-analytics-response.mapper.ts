import type { BookmarkCollectionAnalytics } from '../domain/types/bookmark-collection-analytics';
import type { BookmarkCollectionAnalyticsResponseDto } from '../dto/response';

export class BookmarkCollectionAnalyticsResponseMapper {
  static toResponse(
    analytics: BookmarkCollectionAnalytics,
  ): BookmarkCollectionAnalyticsResponseDto {
    return {
      collectionId: analytics.collectionId,
      collectionName: analytics.collectionName,
      summary: {
        totalBookmarks: analytics.summary.totalBookmarks,
        totalQuizzes: analytics.summary.totalQuizzes,
        averageQuizRating: analytics.summary.averageQuizRating,
        uniqueCategories: analytics.summary.uniqueCategories,
        uniqueTags: analytics.summary.uniqueTags,
      },
      topCategories: analytics.topCategories.map((category) => ({
        categoryId: category.categoryId,
        name: category.name,
        slug: category.slug,
        bookmarkCount: category.bookmarkCount,
      })),
      topTags: analytics.topTags.map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
        slug: tag.slug,
        bookmarkCount: tag.bookmarkCount,
      })),
      lastUpdated: analytics.lastUpdated,
    };
  }
}
