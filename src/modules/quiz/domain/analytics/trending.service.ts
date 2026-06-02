import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MetricsCalculatorService } from './metrics-calculator.service';

@Injectable()
export class TrendingService {
  constructor(
    private readonly metricsCalculator: MetricsCalculatorService,
    @InjectPinoLogger(TrendingService.name)
    private readonly logger: PinoLogger,
  ) {}

  async calculateTrendingScore(quizId: string): Promise<number> {
    return this.metricsCalculator.calculateTrendingScore(quizId);
  }

  async refreshTrendingScores(quizIds: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    for (const quizId of quizIds) {
      try {
        const score = await this.calculateTrendingScore(quizId);
        scores.set(quizId, score);
      } catch (error) {
        this.logger.error({
          event: 'trending_score_calculation_failed',
          quizId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return scores;
  }
}
