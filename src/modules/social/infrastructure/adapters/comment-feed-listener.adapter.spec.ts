/**
 * CommentFeedListenerAdapter unit tests.
 *
 * Verifies that the adapter records exactly one `comment_created`
 * activity per `comment_created` event, and that it ignores every
 * other comment event.
 */
import { CommentFeedListenerAdapter } from './comment-feed-listener.adapter';
import type {
  CommentCreatedEvent,
  CommentMentionedEvent,
  CommentReportedEvent,
} from '@/modules/comment/domain/events/comment.events';
import type { CommentDomainEventBusPort } from '@/modules/comment/domain/events';
import type { SocialService } from '../../domain/services/social.service';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<{
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}>;

const createMockSocialService = (): jest.Mocked<Pick<SocialService, 'recordFeedActivity'>> => ({
  recordFeedActivity: jest.fn().mockResolvedValue(undefined),
});

const createMockEventBus = () => {
  const unsubscribe = jest.fn();
  const bus = {
    subscribe: jest.fn().mockReturnValue(unsubscribe),
  } as unknown as CommentDomainEventBusPort & {
    subscribe: jest.Mock;
  };
  return { bus, unsubscribe };
};

describe('CommentFeedListenerAdapter', () => {
  let socialService: ReturnType<typeof createMockSocialService>;
  let mockBus: ReturnType<typeof createMockEventBus>;
  let listener: CommentFeedListenerAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    socialService = createMockSocialService();
    mockBus = createMockEventBus();

    listener = new CommentFeedListenerAdapter(
      mockBus.bus,
      socialService as unknown as SocialService,
      mockLogger as never,
    );
    listener.onModuleInit();
  });

  afterEach(() => {
    listener.onModuleDestroy();
  });

  it('subscribes to the comment event bus on init', () => {
    expect(mockBus.bus.subscribe).toHaveBeenCalledTimes(1);
  });

  it('records a comment_created activity for top-level comments', async () => {
    const event: CommentCreatedEvent = {
      eventType: 'comment_created',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      parentCommentId: null,
      authorId: 'author-1',
      authorUsername: 'alice',
      parentCommentAuthorId: null,
      isReply: false,
      timestamp: new Date('2026-07-26T00:00:00Z'),
    };

    await listener['handleEvent'](event);

    expect(socialService.recordFeedActivity).toHaveBeenCalledTimes(1);
    expect(socialService.recordFeedActivity).toHaveBeenCalledWith({
      userId: 'author-1',
      activityType: 'comment_created',
      occurredAt: '2026-07-26T00:00:00.000Z',
      payload: {
        commentId: 'comment-1',
        quizId: 'quiz-1',
        parentCommentId: null,
        isReply: false,
      },
    });
  });

  it('records a comment_created activity for replies with the parent comment id', async () => {
    const event: CommentCreatedEvent = {
      eventType: 'comment_created',
      commentId: 'comment-2',
      quizId: 'quiz-1',
      parentCommentId: 'parent-1',
      authorId: 'author-2',
      authorUsername: 'bob',
      parentCommentAuthorId: 'author-1',
      isReply: true,
      timestamp: new Date('2026-07-26T00:00:00Z'),
    };

    await listener['handleEvent'](event);

    expect(socialService.recordFeedActivity).toHaveBeenCalledWith({
      userId: 'author-2',
      activityType: 'comment_created',
      occurredAt: '2026-07-26T00:00:00.000Z',
      payload: {
        commentId: 'comment-2',
        quizId: 'quiz-1',
        parentCommentId: 'parent-1',
        isReply: true,
      },
    });
  });

  it('ignores non-comment_created events', async () => {
    const events: Array<CommentMentionedEvent | CommentReportedEvent> = [
      {
        eventType: 'comment_mentioned',
        commentId: 'comment-1',
        quizId: 'quiz-1',
        mentionedUserId: 'u1',
        mentionedUsername: 'bob',
        authorId: 'author-1',
        authorUsername: 'alice',
        timestamp: new Date('2026-07-26T00:00:00Z'),
      },
      {
        eventType: 'comment_reported',
        reportId: 'report-1',
        commentId: 'comment-1',
        quizId: 'quiz-1',
        commentExcerpt: 'excerpt',
        reporterId: 'reporter-1',
        reason: 'spam',
        timestamp: new Date('2026-07-26T00:00:00Z'),
      },
    ];

    for (const event of events) {
      await listener['handleEvent'](event);
    }

    expect(socialService.recordFeedActivity).not.toHaveBeenCalled();
  });

  it('unsubscribes on module destroy', () => {
    listener.onModuleDestroy();
    expect(mockBus.unsubscribe).toHaveBeenCalledTimes(1);
    listener.onModuleDestroy();
    expect(mockBus.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
