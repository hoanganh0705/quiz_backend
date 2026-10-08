/**
 * Quiz directory bundle.
 *
 * The directory view needs the filtered page plus the taxonomy rails that
 * frame it. Assembling them here keeps the composition out of the transport
 * layer, so the REST and GraphQL surfaces return an identical payload without
 * either of them re-implementing the assembly.
 */
import { Injectable } from '@nestjs/common';

import { QuizApplicationService } from './quiz.application.service';
import { TagApplicationService } from '@/modules/tag/application/tag.application.service';
import { CategoryQueryService } from '@/modules/category/application/category-query.service';
import { QUIZ_BUNDLE_LIMITS } from './quizzes-bundle.constants';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type {
  PopularQuizItemDto,
  TrendingQuizItemDto,
} from '@/modules/quiz/dto/response/quiz-analytics.dto';
import type { RankedCategoryResponseDto } from '@/modules/category/dto/response/ranked-category-response.dto';
import type { RankedTagResponseDto } from '@/modules/tag/dto/response/parity-response.dto';

export type QuizzesBundleRequest = {
  filters: ListQuizzesQueryDto;
  railLimit?: number;
};

export type QuizzesBundle = {
  items: QuizListResponseDto;
  popular: PopularQuizItemDto[];
  trending: TrendingQuizItemDto[];
  categories: RankedCategoryResponseDto[];
  tags: RankedTagResponseDto[];
};

@Injectable()
export class QuizzesBundleService {
  constructor(
    private readonly quizApplicationService: QuizApplicationService,
    private readonly categoryQueryService: CategoryQueryService,
    private readonly tagApplicationService: TagApplicationService,
  ) {}

  async getBundle(request: QuizzesBundleRequest): Promise<QuizzesBundle> {
    const railLimit = request.railLimit ?? QUIZ_BUNDLE_LIMITS.DEFAULT_RAIL_LIMIT;
    const filters = await this.resolveTagSlugs(request.filters);

    const [items, popular, trending, categories, tags] = await Promise.all([
      this.quizApplicationService.listQuizzes(filters),
      this.quizApplicationService.getPopularQuizzes(railLimit, filters.categoryId),
      this.quizApplicationService.getTrendingQuizzes(railLimit, filters.categoryId),
      this.categoryQueryService.getPopularCategories({ limit: railLimit }),
      this.tagApplicationService.getPopularTags({ limit: railLimit }),
    ]);

    return { items, popular, trending, categories, tags };
  }

  /**
   * Tag slugs are URL-visible and stable, while the listing filters on
   * identifiers, so the translation happens once here rather than in every
   * transport. An explicit `tagIds` selection wins, because a caller that
   * already holds identifiers has nothing to gain from a round trip.
   */
  private async resolveTagSlugs(filters: ListQuizzesQueryDto): Promise<ListQuizzesQueryDto> {
    const slugs = filters.tagSlugs;
    if (!slugs || slugs.length === 0 || filters.tagIds?.length) return filters;

    const tags = await this.tagApplicationService.getTagsBySlugs(slugs);
    return { ...filters, tagIds: tags.map((tag) => tag.tagId) };
  }
}
