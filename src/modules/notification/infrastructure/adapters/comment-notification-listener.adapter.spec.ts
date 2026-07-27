/**
 * CommentNotificationListener unit tests.
 *
 * Verifies the three handlers the listener implements:
 *   - `comment_created`  → reply notification only (skipped for top-level)
 *   - `comment_mentioned` → notifies the mentioned user
 *   - `comment_reported`  → fans out to every admin / moderator
 *
 * Other comment events are intentionally ignored and verified as such.
 */
import { CommentNotificationListener } from './comment-notification-listener.adapter';
import type {
  CommentCreatedEvent,
  CommentMentionedEvent,
  CommentReportedEvent,
  VoteCastEvent,
} from '@/modules/comment/domain/events/comment.events';
import type { CommentDomainEventBusPort } from '@/modules/comment/domain/events';
import type { NotificationChannelServicePort } from '../../domain/ports';
import type { UserRepositoryPort } from '@/modules/user/domain/ports/user-repository.port';

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

const createMockChannelService = (): jest.Mocked<NotificationChannelServicePort> => ({
  send: jest.fn().mockResolvedValue(undefined),
});

const createMockUserRepository = (): jest.Mocked<UserRepositoryPort> => ({
  findUsersByRole: jest.fn(),
} as unknown as jest.Mocked<UserRepositoryPort>);

const createMockEventBus = () => {
  const unsubscribe = jest.fn();
  const bus = {
    subscribe: jest.fn().mockReturnValue(unsubscribe),
  } as unknown as CommentDomainEventBusPort & {
    subscribe: jest.Mock;
  };
  return { bus, unsubscribe };
};

describe('CommentNotificationListener', () => {
  let channelService: ReturnType<typeof createMockChannelService>;
  let userRepository: ReturnType<typeof createMockUserRepository>;
  let mockBus: ReturnType<typeof createMockEventBus>;
  let listener: CommentNotificationListener;

  beforeEach(() => {
    jest.clearAllMocks();
    channelService = createMockChannelService();
    userRepository = createMockUserRepository();
    mockBus = createMockEventBus();

    listener = new CommentNotificationListener(
      mockBus.bus,
      channelService,
      userRepository,
      mockLogger as never,
    );
    listener.onModuleInit();
  });

  afterEach(() => {
    listener.onModuleDestroy();
  });

  it('subscribes to the comment event bus on init', () => {
    expect(mockBus.bus.subscribe).toHaveBeenCalledTimes(1);
    expect(typeof mockBus.bus.subscribe.mock.calls[0][0]).toBe('function');
  });

  describe('comment_created', () => {
    const buildEvent = (overrides: Partial<CommentCreatedEvent> = {}): CommentCreatedEvent => ({
      eventType: 'comment_created',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      parentCommentId: 'parent-1',
      authorId: 'author-1',
      authorUsername: 'alice',
      parentCommentAuthorId: 'parent-author-1',
      isReply: true,
      timestamp: new Date('2026-07-26T00:00:00Z'),
      ...overrides,
    });

    it('notifies the parent comment author when the new comment is a reply', async () => {
      const event = buildEvent();

      await listener['handleEvent'](event);

      expect(channelService.send).toHaveBeenCalledWith({
        userId: 'parent-author-1',
        type: 'comment_reply',
        title: 'New reply to your comment',
        body: 'alice replied to your comment',
        metadata: {
          commentId: 'comment-1',
          parentCommentId: 'parent-1',
          quizId: 'quiz-1',
        },
      });
    });

    it('skips the notification for top-level comments', async () => {
      const event = buildEvent({ isReply: false, parentCommentId: null, parentCommentAuthorId: null });

      await listener['handleEvent'](event);

      expect(channelService.send).not.toHaveBeenCalled();
    });

    it('does not throw when the channel service fails', async () => {
      channelService.send.mockRejectedValueOnce(new Error('down'));
      const event = buildEvent();

      await expect(listener['handleEvent'](event)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'comment_reply_notification_failed' }),
      );
    });
  });

  describe('comment_mentioned', () => {
    const buildEvent = (overrides: Partial<CommentMentionedEvent> = {}): CommentMentionedEvent => ({
      eventType: 'comment_mentioned',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      mentionedUserId: 'mentioned-1',
      mentionedUsername: 'bob',
      authorId: 'author-1',
      authorUsername: 'alice',
      timestamp: new Date('2026-07-26T00:00:00Z'),
      ...overrides,
    });

    it('notifies the mentioned user', async () => {
      const event = buildEvent();

      await listener['handleEvent'](event);

      expect(channelService.send).toHaveBeenCalledWith({
        userId: 'mentioned-1',
        type: 'comment_mention',
        title: 'You were mentioned',
        body: 'alice mentioned you in a comment',
        metadata: {
          commentId: 'comment-1',
          quizId: 'quiz-1',
          mentionedUsername: 'bob',
          authorUsername: 'alice',
        },
      });
    });

    it('skips self-mentions', async () => {
      const event = buildEvent({ authorId: 'mentioned-1' });

      await listener['handleEvent'](event);

      expect(channelService.send).not.toHaveBeenCalled();
    });

    it('logs and swallows channel-service failures', async () => {
      channelService.send.mockRejectedValueOnce(new Error('down'));
      const event = buildEvent();

      await expect(listener['handleEvent'](event)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'comment_mention_notification_failed' }),
      );
    });
  });

  describe('comment_reported', () => {
    const buildEvent = (overrides: Partial<CommentReportedEvent> = {}): CommentReportedEvent => ({
      eventType: 'comment_reported',
      reportId: 'report-1',
      commentId: 'comment-1',
      quizId: 'quiz-1',
      commentExcerpt: 'excerpt text',
      reporterId: 'reporter-1',
      reason: 'spam',
      timestamp: new Date('2026-07-26T00:00:00Z'),
      ...overrides,
    });

    it('fans out a moderator alert to every admin and moderator', async () => {
      userRepository.findUsersByRole.mockResolvedValueOnce([
        { userId: 'admin-1' },
        { userId: 'mod-1' },
      ]);
      const event = buildEvent();

      await listener['handleEvent'](event);

      expect(userRepository.findUsersByRole).toHaveBeenCalledWith(['admin', 'moderator']);
      expect(channelService.send).toHaveBeenCalledTimes(2);
      expect(channelService.send).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          userId: 'admin-1',
          type: 'system_announcement',
          title: 'New comment report',
          body: 'Comment reported: spam',
          metadata: expect.objectContaining({
            reportId: 'report-1',
            commentId: 'comment-1',
            quizId: 'quiz-1',
            reporterId: 'reporter-1',
            reason: 'spam',
            excerpt: 'excerpt text',
          }),
        }),
      );
      expect(channelService.send).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ userId: 'mod-1' }),
      );
    });

    it('logs a warning and returns early when no moderators exist', async () => {
      userRepository.findUsersByRole.mockResolvedValueOnce([]);
      const event = buildEvent();

      await listener['handleEvent'](event);

      expect(channelService.send).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'comment_reported_no_moderators' }),
      );
    });

    it('does not throw when the channel service fails for some moderators', async () => {
      userRepository.findUsersByRole.mockResolvedValueOnce([
        { userId: 'admin-1' },
        { userId: 'mod-1' },
      ]);
      channelService.send
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('down'));
      const event = buildEvent();

      await expect(listener['handleEvent'](event)).resolves.toBeUndefined();
    });
  });

  it('ignores events that are not comment_created / comment_mentioned / comment_reported', async () => {
    const event: VoteCastEvent = {
      eventType: 'vote_cast',
      commentId: 'comment-1',
      voterId: 'voter-1',
      value: 'upvote',
      timestamp: new Date('2026-07-26T00:00:00Z'),
    };

    await listener['handleEvent'](event);

    expect(channelService.send).not.toHaveBeenCalled();
    expect(userRepository.findUsersByRole).not.toHaveBeenCalled();
  });

  it('unsubscribes on module destroy', () => {
    listener.onModuleDestroy();
    expect(mockBus.unsubscribe).toHaveBeenCalledTimes(1);
    // Second destroy call should be a no-op
    listener.onModuleDestroy();
    expect(mockBus.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
