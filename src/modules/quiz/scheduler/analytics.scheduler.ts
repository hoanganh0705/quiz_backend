import { Injectable } from '@nestjs/common';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';

@Injectable()
export class AnalyticsSchedulerService {
  constructor(private readonly quizAnalyticsService: QuizAnalyticsService) {}

  async refreshTrendingScores(): Promise<void> {
    await this.quizAnalyticsService.refreshAllTrendingScores();
  }

  async refreshPopularityScores(): Promise<void> {
    await this.quizAnalyticsService.refreshAllPopularityScores();
  }
}
