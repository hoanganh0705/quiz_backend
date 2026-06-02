import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MetricsCalculatorService } from './metrics-calculator.service';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizStats } from '@/core/database/schema';
import { sql } from 'drizzle-orm';

@Injectable()
export class PopularityService {
  constructor(
    private readonly metricsCalculator: MetricsCalculatorService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(PopularityService.name)
    private readonly logger: PinoLogger,
  ) {}

  async calculatePopularityScore(quizId: string): Promise<number> {
    const stats = await this.db
      .select({
        maxAttempts: sql<number>`MAX(${quizStats.totalAttempts})::int`,
        maxBookmarks: sql<number>`MAX(${quizStats.bookmarkCount})::int`,
        maxRatings: sql<number>`MAX(${quizStats.ratingCount})::int`,
      })
      .from(quizStats)
      .where(sql`${quizStats.totalAttempts} > 0 OR ${quizStats.bookmarkCount} > 0 OR ${quizStats.ratingCount} > 0`);

    const maxAttempts = Number(stats[0]?.maxAttempts ?? 0);
    const maxBookmarks = Number(stats[0]?.maxBookmarks ?? 0);
    const maxRatings = Number(stats[0]?.maxRatings ?? 0);

    return this.metricsCalculator.calculatePopularityScore(
      quizId,
      maxAttempts,
      maxBookmarks,
      maxRatings,
    );
  }

  async refreshPopularityScores(quizIds: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    const stats = await this.db
      .select({
        quizId: quizStats.quizId,
        totalAttempts: quizStats.totalAttempts,
        bookmarkCount: quizStats.bookmarkCount,
        ratingCount: quizStats.ratingCount,
      })
      .from(quizStats);

    const maxAttempts = Math.max(...stats.map(s => Number(s.totalAttempts)), 1);
    const maxBookmarks = Math.max(...stats.map(s => Number(s.bookmarkCount)), 1);
    const maxRatings = Math.max(...stats.map(s => Number(s.ratingCount)), 1);

    for (const quizId of quizIds) {
      try {
        const score = await this.metricsCalculator.calculatePopularityScore(
          quizId,
          maxAttempts,
          maxBookmarks,
          maxRatings,
        );
        scores.set(quizId, score);
      } catch (error) {
        this.logger.error({
          event: 'popularity_score_calculation_failed',
          quizId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return scores;
  }
}
