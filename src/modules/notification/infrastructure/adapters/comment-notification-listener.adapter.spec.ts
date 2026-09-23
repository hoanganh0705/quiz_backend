import type { PinoLogger } from 'nestjs-pino';
import { CommentNotificationListener } from './comment-notification-listener.adapter';
import type { CommentDomainEventBusPort } from '@/modules/comment/domain/events';
import type { NotificationChannelServicePort } from '../../domain/ports';
import type { UserRepositoryPort } from '@/modules/user/domain/ports/user-repository.port';

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
  const handlers: Array<(event: unknown) => void> = [];
  const unsubscribe = jest.fn();
  const commentEventBus: CommentDomainEventBusPort = {
    subscribe: jest.fn((handler: (event: unknown) => void) => {
      handlers.push(handler);
      return unsubscribe;
    }),
    emitCommentCreated: jest.fn(),
    emitCommentEdited: jest.fn(),
    emitCommentDeleted: jest.fn(),
    emitCommentHidden: jest.fn(),
    emitCommentRestored: jest.fn(),
    emitCommentMentioned: jest.fn(),
    emitVoteCast: jest.fn(),
    emitVoteRemoved: jest.fn(),
    emitCommentReported: jest.fn(),
    emitReportReviewed: jest.fn(),
  };
  const send = jest.fn().mockResolvedValue(undefined);
  const sendBatch = jest.fn().mockResolvedValue({ sent: 2, skipped: 0 });
  const channelService: NotificationChannelServicePort = { send, sendBatch };
  const userRepository: UserRepositoryPort = {
    findUsersByRole: jest
      .fn()
      .mockResolvedValue([
        { userId: 'mod-1' } as unknown as Awaited<
          ReturnType<UserRepositoryPort['findUsersByRole']>
        >[number],
        { userId: 'mod-2' } as unknown as Awaited<
          ReturnType<UserRepositoryPort['findUsersByRole']>
        >[number],
      ]),
  } as unknown as UserRepositoryPort;

  const listener = new CommentNotificationListener(
    commentEventBus,
    channelService,
    userRepository,
    makeLogger(),
  );
  listener.onModuleInit();
  return { listener, handlers, send, sendBatch, userRepository, channelService, unsubscribe };
}

describe('CommentNotificationListener', () => {
  async function dispatch(handler: (e: unknown) => unknown, event: unknown): Promise<void> {
    handler(event);
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('sends a reply notification for comment_created with parentAuthorId', async () => {
    const { handlers, send } = makeService();
    await dispatch(handlers[0], {
      eventType: 'comment_created',
      commentId: 'c-1',
      parentCommentId: 'p-1',
      parentCommentAuthorId: 'user-1',
      authorUsername: 'alice',
      quizId: 'q-1',
      isReply: true,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'comment_reply',
      }),
    );
  });

  it('ignores a top-level comment_created event (no parent)', async () => {
    const { handlers, send } = makeService();
    await dispatch(handlers[0], {
      eventType: 'comment_created',
      commentId: 'c-2',
      parentCommentId: null,
      parentCommentAuthorId: null,
      authorUsername: 'bob',
      quizId: 'q-1',
      isReply: false,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores comment_mentioned when author mentions themselves', async () => {
    const { handlers, send } = makeService();
    await dispatch(handlers[0], {
      eventType: 'comment_mentioned',
      commentId: 'c-3',
      quizId: 'q-1',
      mentionedUserId: 'user-1',
      authorId: 'user-1',
      authorUsername: 'self',
      mentionedUsername: 'self',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('fan-outs moderator notifications via sendBatch when a comment is reported', async () => {
    const { handlers, sendBatch, userRepository } = makeService();
    await dispatch(handlers[0], {
      eventType: 'comment_reported',
      reportId: 'r-1',
      commentId: 'c-4',
      quizId: 'q-1',
      reporterId: 'user-1',
      reason: 'spam',
      commentExcerpt: 'bad text',
    });
    expect(userRepository.findUsersByRole).toHaveBeenCalledWith(['admin', 'moderator']);
    expect(sendBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system_announcement',
      }),
      ['mod-1', 'mod-2'],
    );
  });

  it('logs a warning when there are no moderators to notify', async () => {
    const { handlers, sendBatch, userRepository } = makeService();
    (userRepository.findUsersByRole as jest.Mock).mockResolvedValueOnce([]);
    await dispatch(handlers[0], {
      eventType: 'comment_reported',
      reportId: 'r-2',
      commentId: 'c-5',
      quizId: 'q-1',
      reporterId: 'user-1',
      reason: 'spam',
      commentExcerpt: 'text',
    });
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('does not respond to unrelated comment events', async () => {
    const { handlers, send, sendBatch } = makeService();
    await dispatch(handlers[0], {
      eventType: 'comment_vote_cast',
      commentId: 'c-6',
      userId: 'user-1',
      voteType: 'upvote',
    });
    expect(send).not.toHaveBeenCalled();
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('unsubscribes on module destroy', () => {
    const { listener, unsubscribe } = makeService();
    listener.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
