/// <reference types="jest" />
import { ReviewService } from '../../domain/review.service';

describe('ReviewService listReviews', () => {
  const createService = () => {
    const reviewRepository = {
      listReviewsByQuiz: jest.fn(),
    } as unknown as ConstructorParameters<typeof ReviewService>[0];

    const quizRepository = {
      getActiveQuizRecordById: jest.fn(),
    } as ConstructorParameters<typeof ReviewService>[1];

    const analyticsEventHandler = {
      onReviewSubmitted: jest.fn(),
      onReviewDeleted: jest.fn(),
    } as ConstructorParameters<typeof ReviewService>[2];

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as ConstructorParameters<typeof ReviewService>[3];

    const service = new ReviewService(
      reviewRepository as never,
      quizRepository as never,
      analyticsEventHandler as never,
      logger as never,
    );

    return { service, reviewRepository: reviewRepository as { listReviewsByQuiz: jest.Mock } };
  };

  it('lists all reviews when rating filter is not provided', async () => {
    const { service, reviewRepository } = createService();
    reviewRepository.listReviewsByQuiz.mockResolvedValue([]);

    await service.listReviews('quiz-1', 20, null, undefined);

    expect(reviewRepository.listReviewsByQuiz).toHaveBeenCalledWith({
      quizId: 'quiz-1',
      limit: 20,
      cursor: null,
      rating: undefined,
    });
  });

  it('passes 1-star rating filter to repository', async () => {
    const { service, reviewRepository } = createService();
    reviewRepository.listReviewsByQuiz.mockResolvedValue([]);

    await service.listReviews('quiz-1', 20, null, 1);

    expect(reviewRepository.listReviewsByQuiz).toHaveBeenCalledWith({
      quizId: 'quiz-1',
      limit: 20,
      cursor: null,
      rating: 1,
    });
  });

  it('passes 5-star rating filter to repository', async () => {
    const { service, reviewRepository } = createService();
    reviewRepository.listReviewsByQuiz.mockResolvedValue([]);

    await service.listReviews('quiz-1', 20, null, 5);

    expect(reviewRepository.listReviewsByQuiz).toHaveBeenCalledWith({
      quizId: 'quiz-1',
      limit: 20,
      cursor: null,
      rating: 5,
    });
  });

  it('keeps pagination cursor when rating filter is applied', async () => {
    const { service, reviewRepository } = createService();
    const cursor = { createdAt: '2026-01-01T00:00:00.000Z', reviewId: 'review-1' };
    reviewRepository.listReviewsByQuiz.mockResolvedValue([]);

    await service.listReviews('quiz-1', 10, cursor, 5);

    expect(reviewRepository.listReviewsByQuiz).toHaveBeenCalledWith({
      quizId: 'quiz-1',
      limit: 10,
      cursor,
      rating: 5,
    });
  });
});
