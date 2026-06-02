export class QuizAnalyticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuizAnalyticsError';
  }
}

export class QuizNotFoundError extends QuizAnalyticsError {
  constructor(quizId: string) {
    super(`Quiz not found: ${quizId}`);
    this.name = 'QuizNotFoundError';
  }
}

export class AnalyticsCalculationError extends QuizAnalyticsError {
  constructor(message: string) {
    super(`Analytics calculation failed: ${message}`);
    this.name = 'AnalyticsCalculationError';
  }
}
