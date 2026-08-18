import { Injectable } from '@nestjs/common';

import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import { CategoryQueryService } from '@/modules/category/application/category-query.service';
import { RecentWinnersService } from '@/modules/ranking/application/recent-winners.service';
import { LeaderboardService } from '@/modules/ranking/domain/services/leaderboard.service';
import { RankingPeriodEnum } from '@/modules/ranking/dto/request/leaderboard-query.dto';
import type { CategoryResponseDto } from '@/modules/category/dto/response/category-response.dto';

import { HomeBundleResponseDto } from '../dto/response/home-bundle-response.dto';

/**
 * `HomeApplicationService` — orchestrates the home-page bundle
 * returned by `GET /home` (Phase 4 / S-23).
 *
 * The issuer-page used to fan out 6+ sequential calls
 * (`featured`, `trending`, `popular`, `categories`, `recent-winners`,
 * top weekly leaderboard). The bundle collapses the fan-out into a
 * single round-trip by parallelising the sub-queries with
 * `Promise.all`. The sub-services are the existing per-domain
 * services — the bundle never reaches into repositories directly.
 *
 * ## Layout (matches `HomeBundleResponseDto`)
 *
 *   - `featured`        ← `QuizApplicationService.getFeaturedQuizzes()` (limit 12)
 *   - `trending`        ← `QuizApplicationService.getTrendingQuizzes()` (limit 10)
 *   - `popular`         ← `QuizApplicationService.getPopularQuizzes()`  (limit 10)
 *   - `categories`      ← `CategoryQueryService.listCategories()`      (limit 20)
 *   - `recentWinners`   ← `RecentWinnersService.getRecentWinners()`     (last 10)
 *   - `topPlayers`      ← `LeaderboardService.getGlobalLeaderboard()`   (limit 5, week)
 *
 * ## Caching
 *
 * The bundle is intended to be cached under
 * `home:bundle:v1` (60s TTL + jittered stale window). The
 * `CacheService` integration is wired in a follow-up; the
 * service-level fan-out below is the prerequisite — calling 6
 * services in parallel is the actual perf win.
 *
 * ## Error handling
 *
 * The endpoint is `Public()` and the bundle is best-effort:
 * any sub-query failure rejects the whole bundle with a
 * `GlobalInternalError`. The frontend renders the rails
 * individually when the bundle fetch fails.
 */
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
      // The category service returns a paginated envelope; the
      // bundle needs a flat array.
      categories: Array.isArray(
        (categoriesResult as { items?: readonly CategoryResponseDto[] })?.items,
      )
        ? ((categoriesResult as { items: readonly CategoryResponseDto[] })
            .items as HomeBundleResponseDto['categories'])
        : [],
      recentWinners,
      topPlayers: topPlayersResult.entries,
    };
  }
}
