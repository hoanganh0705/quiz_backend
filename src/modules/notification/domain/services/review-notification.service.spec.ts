import type { PinoLogger } from 'nestjs-pino';
import { ReviewNotificationService } from './review-notification.service';
import type { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

function makeService() {
  const send = jest.fn().mockResolvedValue(undefined);
  const channelService = { send } as unknown as NotificationChannelService;
  const service = new ReviewNotificationService(channelService, makeLogger());
  return { service, send };
}

describe('ReviewNotificationService.notifyReviewSubmitted', () => {
  it('sends a notification for a new review', async () => {
    const { service, send } = makeService();
    await service.notifyReviewSubmitted({
      quizCreatorId: 'creator-1',
      quizTitle: 'My Quiz',
      quizId: 'q-1',
      reviewerId: 'reviewer-1',
      reviewerUsername: 'alice',
      rating: 5,
      hasComment: false,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'creator-1',
        type: 'quiz_review_received',
        title: 'New Review on Your Quiz',
        body: 'alice left a 5-star review on "My Quiz"',
      }),
    );
  });

  it('appends "(with comment)" when the review includes a comment', async () => {
    const { service, send } = makeService();
    await service.notifyReviewSubmitted({
      quizCreatorId: 'creator-1',
      quizTitle: 'My Quiz',
      quizId: 'q-1',
      reviewerId: 'reviewer-1',
      reviewerUsername: 'alice',
      rating: 4,
      hasComment: true,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'alice left a 4-star review (with comment) on "My Quiz"',
      }),
    );
  });

  it('uses "Someone" when reviewerUsername is null', async () => {
    const { service, send } = makeService();
    await service.notifyReviewSubmitted({
      quizCreatorId: 'creator-1',
      quizTitle: 'My Quiz',
      quizId: 'q-1',
      reviewerId: 'reviewer-1',
      reviewerUsername: null as unknown as string,
      rating: 3,
      hasComment: false,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Someone left a 3-star review on "My Quiz"',
      }),
    );
  });

  it('skips notification when creator is the reviewer (self-review)', async () => {
    const { service, send } = makeService();
    await service.notifyReviewSubmitted({
      quizCreatorId: 'user-1',
      quizTitle: 'My Quiz',
      quizId: 'q-1',
      reviewerId: 'user-1',
      reviewerUsername: 'self',
      rating: 5,
      hasComment: false,
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('ReviewNotificationService.notifyReviewDeleted', () => {
  it('sends a review-removed notification', async () => {
    const { service, send } = makeService();
    await service.notifyReviewDeleted({
      quizCreatorId: 'creator-1',
      quizTitle: 'My Quiz',
      quizId: 'q-1',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'creator-1',
        type: 'quiz_review_received',
        title: 'Review Removed from Your Quiz',
        body: 'A review on your quiz "My Quiz" was deleted',
      }),
    );
  });
});
