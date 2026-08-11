import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from '@/modules/ranking/dto/response/leaderboard-entry.dto';
import { QuizListItemDto } from '@/modules/quiz/dto/response/quiz-list-item.dto';
import { TrendingQuizItemDto, PopularQuizItemDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { CategoryResponseDto } from '@/modules/category/dto/response/category-response.dto';
import { RecentWinnersResponseDto } from '@/modules/ranking/dto/response/recent-winners-response.dto';

/**
 * `HomeBundleResponseDto` — the aggregate payload returned by
 * `GET /home` (Phase 4 / S-23).
 *
 * The endpoint replaces the cascading fetches the home page used
 * to issue (featured + trending + popular + categories + live
 * winners + top players + recent winners) with a single call. The
 * backend parallelises the sub-queries and (in a follow-up) caches
 * the bundle in Redis under `home:bundle:v1` (60s TTL + jittered
 * stale window). The wire shape is the union of the existing per
 * endpoint DTOs so the frontend can drop the bundle straight into
 * the existing rails with no consumer-side projection.
 *
 * ## Stability
 *
 * The endpoint is `Public()` (no auth required). Layout:
 *
 *   ```ts
 *   {
 *     featured: QuizListItemDto[],          // editorial set (max 12)
 *     trending: TrendingQuizItemDto[],      // trending-ranked (max 10)
 *     popular:  PopularQuizItemDto[],       // popularity-ranked (max 10)
 *     categories: CategoryResponseDto[],    // top-level categories (max 20)
 *     recentWinners: RecentWinnersResponseDto, // last 10 winners
 *     topPlayers: LeaderboardEntryDto[],    // top 5 weekly
 *   }
 *   ```
 *
 * The bundle is read-only by spec — no mutations, no poll, no socket.
 */
export class HomeBundleResponseDto {
  @ApiProperty({
    description: 'Editorially curated featured quizzes (max 12)',
    type: () => [QuizListItemDto],
  })
  featured!: QuizListItemDto[];

  @ApiProperty({
    description: 'Trending quizzes (max 10)',
    type: () => [TrendingQuizItemDto],
  })
  trending!: TrendingQuizItemDto[];

  @ApiProperty({
    description: 'Popular quizzes (max 10)',
    type: () => [PopularQuizItemDto],
  })
  popular!: PopularQuizItemDto[];

  @ApiProperty({
    description: 'Top-level categories (max 20)',
    type: () => [CategoryResponseDto],
  })
  categories!: CategoryResponseDto[];

  @ApiProperty({
    description: 'Recent tournament winners (last 10)',
    type: () => RecentWinnersResponseDto,
  })
  recentWinners!: RecentWinnersResponseDto;

  @ApiProperty({
    description: 'Top 5 weekly players',
    type: () => [LeaderboardEntryDto],
  })
  topPlayers!: LeaderboardEntryDto[];
}
