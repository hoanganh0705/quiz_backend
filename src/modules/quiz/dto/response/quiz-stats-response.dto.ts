import { ApiProperty } from '@nestjs/swagger';
import { QuizStatsHistoryPointDto } from './quiz-stats-history-point.dto';

/**
 * Phase 2 (S-10) enriched the stats DTO from a flat counter set
 * into a "header counters + sparkline" projection:
 *   - `commentsCount` — counters comments, since `quiz_stats` did
 *                       not previously surface a comment aggregate
 *   - `recentActivity` — last-30-days attempt timeline for the
 *                       stats panel sparkline
 *
 * The detailed counters stay where they were (they were not in the
 * audit gap list — the gaps were around missing fields, not
 * structural issues). The added fields are additive so existing
 * consumers (the read-side dashboard's `useQuizStats` hook) keep
 * working unchanged.
 */
export class QuizStatsResponseDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Total number of attempts recorded for this quiz', example: 1240 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Number of distinct users who attempted this quiz', example: 830 })
  uniquePlayers!: number;

  @ApiProperty({ description: 'Average score percent across all attempts', example: 78.4 })
  averageScore!: number;

  @ApiProperty({
    description: 'Average review rating across all reviews (0–5 scale)',
    example: 4.6,
  })
  averageRating!: number;

  @ApiProperty({ description: 'Number of users who bookmarked this quiz', example: 95 })
  bookmarkCount!: number;

  @ApiProperty({
    description: 'Percentage of started attempts that reached completion',
    example: 86.5,
  })
  completionRate!: number;

  @ApiProperty({ description: 'Computed long-term popularity score', example: 91.2743 })
  popularityScore!: number;

  @ApiProperty({ description: 'Computed short-term trending score', example: 43.1182 })
  trendingScore!: number;

  /**
   * Phase 2 (S-10): total non-deleted root comments attached to
   * the quiz. Sourced directly from `comments` (we do not maintain
   * a counter on `quiz_stats` for this).
   */
  @ApiProperty({
    description: 'Total comments on the quiz (root + replies, excluding soft-deleted rows)',
    example: 42,
  })
  commentsCount!: number;

  /**
   * Phase 2 (S-10): 30-day activity timeline. One entry per day,
   * with gaps densified to zero so the client can plot a continuous
   * sparkline without further math. See `QuizStatsHistoryPointDto`.
   *
   * The sparkline is a read of `quiz_attempts` bucketed by
   * `date_trunc('day', finished_at)`. The default range today is
   * hard-coded to 30 days; a future enhancement is to pass
   * `?range=7d|30d` on the route and re-derive the window.
   */
  @ApiProperty({
    description: 'Last-30-day activity timeline (one entry per day, gaps filled with zeros)',
    type: () => [QuizStatsHistoryPointDto],
  })
  recentActivity!: QuizStatsHistoryPointDto[];
}
