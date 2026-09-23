/* eslint-disable @typescript-eslint/unbound-method */
import { HomeApplicationService } from './home.application.service';
import type { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import type { CategoryQueryService } from '@/modules/category/application/category-query.service';
import type { RecentWinnersService } from '@/modules/ranking/application/recent-winners.service';
import type { LeaderboardService } from '@/modules/ranking/domain/services/leaderboard.service';
import type { CategoryResponseDto } from '@/modules/category/dto/response/category-response.dto';
import type { RecentWinnersResponseDto } from '@/modules/ranking/dto/response/recent-winners-response.dto';
import type { LeaderboardEntryDto } from '@/modules/ranking/dto/response/leaderboard-entry.dto';
import type { RelatedQuizzesResponseDto } from '@/modules/quiz/dto/response/related-quizzes-response.dto';
import type {
  TrendingQuizItemDto,
  PopularQuizItemDto,
} from '@/modules/quiz/dto/response/quiz-analytics.dto';

interface FakeQuizApp {
  getFeaturedQuizzes: unknown;
  getTrendingQuizzes: unknown;
  getPopularQuizzes: unknown;
}

interface FakeCategoryQuery {
  listCategories: unknown;
}

interface FakeRecentWinners {
  getRecentWinners: unknown;
}

interface FakeLeaderboard {
  getGlobalLeaderboard: unknown;
}

function buildDeps() {
  const featured = { items: [{ quizId: 'q1' } as never] } as RelatedQuizzesResponseDto;
  const trending: TrendingQuizItemDto[] = [{ quizId: 't1', title: 'T1' } as never];
  const popular: PopularQuizItemDto[] = [{ quizId: 'p1', title: 'P1' } as never];

  const categories: CategoryResponseDto[] = [
    { categoryId: 'c1', name: 'C1', slug: 'c1' } as CategoryResponseDto,
    { categoryId: 'c2', name: 'C2', slug: 'c2' } as CategoryResponseDto,
  ];

  const recentWinners = { winners: [{ userId: 'u1' }] } as RecentWinnersResponseDto;
  const topPlayers: LeaderboardEntryDto[] = [{ userId: 'u1', rank: 1 } as LeaderboardEntryDto];

  const quizApplicationService: FakeQuizApp = {
    getFeaturedQuizzes: jest.fn().mockResolvedValue(featured),
    getTrendingQuizzes: jest.fn().mockResolvedValue(trending),
    getPopularQuizzes: jest.fn().mockResolvedValue(popular),
  };
  const categoryQueryService: FakeCategoryQuery = {
    listCategories: jest.fn().mockResolvedValue({ items: categories }),
  };
  const recentWinnersService: FakeRecentWinners = {
    getRecentWinners: jest.fn().mockResolvedValue(recentWinners),
  };
  const leaderboardService: FakeLeaderboard = {
    getGlobalLeaderboard: jest.fn().mockResolvedValue({ entries: topPlayers }),
  };

  return {
    quizApplicationService: quizApplicationService as unknown as QuizApplicationService,
    categoryQueryService: categoryQueryService as unknown as CategoryQueryService,
    recentWinnersService: recentWinnersService as unknown as RecentWinnersService,
    leaderboardService: leaderboardService as unknown as LeaderboardService,
    expected: { featured, trending, popular, categories, recentWinners, topPlayers },
  };
}

describe('HomeApplicationService', () => {
  it('composes the bundle from each downstream dependency', async () => {
    const deps = buildDeps();
    const service = new HomeApplicationService(
      deps.quizApplicationService,
      deps.categoryQueryService,
      deps.recentWinnersService,
      deps.leaderboardService,
    );

    const result = await service.getBundle();

    expect(result.featured).toBe(deps.expected.featured.items);
    expect(result.trending).toBe(deps.expected.trending);
    expect(result.popular).toBe(deps.expected.popular);
    expect(result.categories).toEqual(deps.expected.categories);
    expect(result.recentWinners).toBe(deps.expected.recentWinners);
    expect(result.topPlayers).toBe(deps.expected.topPlayers);
  });

  it('invokes each dependency with the documented limits', async () => {
    const deps = buildDeps();
    const service = new HomeApplicationService(
      deps.quizApplicationService,
      deps.categoryQueryService,
      deps.recentWinnersService,
      deps.leaderboardService,
    );

    await service.getBundle();

    expect(deps.quizApplicationService.getFeaturedQuizzes).toHaveBeenCalledWith({ limit: 12 });
    expect(deps.quizApplicationService.getTrendingQuizzes).toHaveBeenCalledWith(10);
    expect(deps.quizApplicationService.getPopularQuizzes).toHaveBeenCalledWith(10);
    expect(deps.categoryQueryService.listCategories).toHaveBeenCalledWith({ limit: 20 });
    expect(deps.recentWinnersService.getRecentWinners).toHaveBeenCalledWith(10);
    expect(deps.leaderboardService.getGlobalLeaderboard).toHaveBeenCalledWith({
      period: 'weekly',
      limit: 5,
      offset: 0,
    });
  });

  it('uses empty arrays when featured/categories are missing', async () => {
    const deps = buildDeps();
    (deps.quizApplicationService.getFeaturedQuizzes as jest.Mock).mockResolvedValue({
      items: undefined,
    });
    (deps.categoryQueryService.listCategories as jest.Mock).mockResolvedValue({ items: [] });

    const service = new HomeApplicationService(
      deps.quizApplicationService,
      deps.categoryQueryService,
      deps.recentWinnersService,
      deps.leaderboardService,
    );

    const result = await service.getBundle();

    expect(result.featured).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it('returns an empty categories array when the upstream envelope is malformed', async () => {
    const deps = buildDeps();
    (deps.categoryQueryService.listCategories as jest.Mock).mockResolvedValue({
      unexpected: true,
    });

    const service = new HomeApplicationService(
      deps.quizApplicationService,
      deps.categoryQueryService,
      deps.recentWinnersService,
      deps.leaderboardService,
    );

    const result = await service.getBundle();

    expect(result.categories).toEqual([]);
  });

  it('returns an empty categories array when upstream returns null', async () => {
    const deps = buildDeps();
    (deps.categoryQueryService.listCategories as jest.Mock).mockResolvedValue(null);

    const service = new HomeApplicationService(
      deps.quizApplicationService,
      deps.categoryQueryService,
      deps.recentWinnersService,
      deps.leaderboardService,
    );

    const result = await service.getBundle();

    expect(result.categories).toEqual([]);
  });

  it('fans out to every downstream call concurrently', async () => {
    const deps = buildDeps();
    const order: string[] = [];
    const wrap =
      <T>(name: string, value: T): (() => Promise<T>) =>
      () => {
        order.push(name);
        return new Promise((resolve) => {
          setTimeout(() => resolve(value), 5);
        });
      };
    (deps.quizApplicationService.getFeaturedQuizzes as jest.Mock).mockImplementation(
      wrap('f', {
        items: [],
      }),
    );
    (deps.quizApplicationService.getTrendingQuizzes as jest.Mock).mockImplementation(wrap('t', []));
    (deps.quizApplicationService.getPopularQuizzes as jest.Mock).mockImplementation(wrap('p', []));
    (deps.categoryQueryService.listCategories as jest.Mock).mockImplementation(
      wrap('c', {
        items: [],
      }),
    );
    (deps.recentWinnersService.getRecentWinners as jest.Mock).mockImplementation(
      wrap('r', {
        winners: [],
      }),
    );
    (deps.leaderboardService.getGlobalLeaderboard as jest.Mock).mockImplementation(
      wrap('l', {
        entries: [],
      }),
    );

    const service = new HomeApplicationService(
      deps.quizApplicationService,
      deps.categoryQueryService,
      deps.recentWinnersService,
      deps.leaderboardService,
    );

    await service.getBundle();

    expect(order.sort()).toEqual(['c', 'f', 'l', 'p', 'r', 't']);
  });
});
