import { Injectable } from '@nestjs/common';

import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import { CategoryQueryService } from '@/modules/category/application/category-query.service';
import { RecentWinnersService } from '@/modules/ranking/application/recent-winners.service';
import { LeaderboardService } from '@/modules/ranking/domain/services/leaderboard.service';
import { RankingPeriodEnum } from '@/modules/ranking/dto/request/leaderboard-query.dto';
import type { CategoryResponseDto } from '@/modules/category/dto/response/category-response.dto';

import { HomeBundleResponseDto } from '../dto/response/home-bundle-response.dto';

function unwrapCategories(value: unknown): CategoryResponseDto[] {
  if (value && typeof value === 'object' && 'items' in value) {
    const items = (value as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items as CategoryResponseDto[];
    }
  }
  return [];
}

@Injectable()
export class HomeApplicationService {
  constructor(
    private readonly quizApplicationService: QuizApplicationService,
    private readonly categoryQueryService: CategoryQueryService,
    private readonly recentWinnersService: RecentWinnersService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  async getBundle(): Promise<HomeBundleResponseDto> {
    const [
      featuredResult,
      trendingResult,
      popularResult,
      categoriesResult,
      recentWinners,
      topPlayersResult,
    ] = await Promise.all([
      this.quizApplicationService.getFeaturedQuizzes({ limit: 12 }),
      this.quizApplicationService.getTrendingQuizzes(10),
      this.quizApplicationService.getPopularQuizzes(10),
      this.categoryQueryService.listCategories({
        limit: 20,
      }),
      this.recentWinnersService.getRecentWinners(10),
      this.leaderboardService.getGlobalLeaderboard({
        period: RankingPeriodEnum.WEEKLY,
        limit: 5,
        offset: 0,
      }),
    ]);

    return {
      featured: featuredResult.items ?? [],
      trending: trendingResult,
      popular: popularResult,
      categories: unwrapCategories(categoriesResult),
      recentWinners,
      topPlayers: topPlayersResult.entries,
    };
  }
}
