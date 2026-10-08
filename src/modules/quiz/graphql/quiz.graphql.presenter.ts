/**
 * Presentation for the quiz directory bundle.
 *
 * The bundle already carries display-ready values, so mapping here is limited
 * to reshaping the flat listing row into the nested category object the schema
 * exposes. Every step tolerates a missing nested value rather than assuming it.
 */
import type { QuizListItemDto } from '@/modules/quiz/dto/response/quiz-list-item.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { AuthorSummaryDto } from '@/modules/quiz/dto/response/author-summary.dto';
import type { QuizTagDto } from '@/modules/quiz/dto/response/quiz-tag.dto';
import type {
  PopularQuizItemDto,
  TrendingQuizItemDto,
} from '@/modules/quiz/dto/response/quiz-analytics.dto';
import type { RankedCategoryResponseDto } from '@/modules/category/dto/response/ranked-category-response.dto';
import type { RankedTagResponseDto } from '@/modules/tag/dto/response/parity-response.dto';
import type { QuizzesBundle } from '@/modules/quiz/application/quizzes-bundle.service';

import type {
  PopularQuizGql,
  QuizAuthorGql,
  QuizCategoryGql,
  QuizGql,
  QuizPageInfoGql,
  QuizTagGql,
  RankedCategoryGql,
  RankedTagGql,
  TrendingQuizGql,
} from './quiz.graphql.types';

export type PresentedQuizzesBundle = {
  items: QuizGql[];
  pageInfo: QuizPageInfoGql;
  popular: PopularQuizGql[];
  trending: TrendingQuizGql[];
  categories: RankedCategoryGql[];
  tags: RankedTagGql[];
};

const toAuthor = (author: AuthorSummaryDto | null): QuizAuthorGql | null =>
  author
    ? {
        userId: author.userId,
        username: author.username,
        displayName: author.displayName ?? null,
        avatarUrl: author.avatarUrl ?? null,
      }
    : null;

const toTag = (tag: QuizTagDto): QuizTagGql => ({
  tagId: tag.tagId,
  name: tag.name,
  slug: tag.slug,
});

/**
 * The listing row carries category identity as a bare id plus resolved name
 * and slug, so the nested object is only complete when all three are present.
 */
const toCategory = (item: QuizListItemDto): QuizCategoryGql | null =>
  item.categoryId && item.categoryName && item.categorySlug
    ? { categoryId: item.categoryId, name: item.categoryName, slug: item.categorySlug }
    : null;

const toQuiz = (item: QuizListItemDto): QuizGql => ({
  quizId: item.quizId,
  creatorId: item.creatorId ?? null,
  creator: toAuthor(item.creator ?? null),
  title: item.title,
  description: item.description ?? null,
  slug: item.slug,
  imageUrl: item.imageUrl ?? null,
  difficulty: item.publishedVersion?.difficulty
    ? { label: item.publishedVersion.difficulty }
    : null,
  category: toCategory(item),
  tags: (item.tags ?? []).map(toTag),
  isFeatured: item.isFeatured,
  questionCount: item.questionCount,
  averageRating: item.averageRating,
  reviewCount: item.reviewCount,
  attemptCount: item.attemptCount,
});

const toPageInfo = (response: QuizListResponseDto): QuizPageInfoGql => ({
  limit: response.pagination.limit,
  nextCursor: response.pagination.nextCursor,
  hasNextPage: response.pagination.hasNextPage,
});

const toRankedCategory = (row: RankedCategoryResponseDto): RankedCategoryGql => ({
  rank: row.rank,
  categoryId: row.categoryId,
  name: row.name,
  slug: row.slug,
});

const toRankedTag = (row: RankedTagResponseDto): RankedTagGql => ({
  rank: row.rank,
  tagId: row.tagId,
  name: row.name,
  slug: row.slug,
});

const toPopular = (row: PopularQuizItemDto): PopularQuizGql => ({
  rank: row.rank,
  quizId: row.quizId,
  title: row.title,
  slug: row.slug,
  imageUrl: row.imageUrl ?? null,
  popularityScore: row.popularityScore,
  totalAttempts: row.totalAttempts,
});

const toTrending = (row: TrendingQuizItemDto): TrendingQuizGql => ({
  rank: row.rank,
  quizId: row.quizId,
  title: row.title,
  slug: row.slug,
  imageUrl: row.imageUrl ?? null,
  trendingScore: row.trendingScore,
  totalAttempts: row.totalAttempts,
});

export const presentQuizzesBundle = (bundle: QuizzesBundle): PresentedQuizzesBundle => ({
  items: bundle.items.items.map(toQuiz),
  pageInfo: toPageInfo(bundle.items),
  popular: bundle.popular.map(toPopular),
  trending: bundle.trending.map(toTrending),
  categories: bundle.categories.map(toRankedCategory),
  tags: bundle.tags.map(toRankedTag),
});
