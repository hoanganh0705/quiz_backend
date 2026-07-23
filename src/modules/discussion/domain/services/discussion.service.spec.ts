/**
 * DiscussionService unit tests.
 *
 * Tests the domain service methods:
 *   - `createThread` — thread creation with quiz validation
 *   - `createComment` — comment creation with thread/comment validation
 *   - `vote` — voting with self-vote prevention
 *   - `removeVote` — vote removal with event emission
 *   - `subscribeToThread` — thread subscription
 *   - `saveThread` — thread saving
 *   - `closeThread` — thread closure
 *   - `deleteThread` — thread deletion with cascade
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { DiscussionService } from './discussion.service';
import {
  ThreadNotFoundError,
  CommentNotFoundError,
  ThreadForbiddenError,
  ThreadClosedError,
  ThreadNotActiveError,
  CommentThreadMismatchError,
  SelfVoteError,
  QuizNotFoundError,
  ReplyLimitExceededError,
} from '../errors';
import { MAX_REPLIES_PER_COMMENT } from '../../infrastructure/repositories/discussion.repository';

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

const createMockRepository = () => ({
  createThread: jest.fn(),
  getThreadById: jest.fn(),
  getThreadByIdForUpdate: jest.fn(),
  updateThread: jest.fn(),
  deleteThread: jest.fn(),
  softDeleteThread: jest.fn(),
  restoreThread: jest.fn(),
  hideThread: jest.fn(),
  unhideThread: jest.fn(),
  updateThreadStatus: jest.fn(),
  updateThreadVotes: jest.fn(),
  incrementThreadCommentCount: jest.fn(),
  markThreadAsSolved: jest.fn(),
  unmarkThreadAsSolved: jest.fn(),
  softDeleteCommentsByThread: jest.fn(),
  restoreCommentsByThread: jest.fn(),
  createComment: jest.fn(),
  getCommentById: jest.fn(),
  getCommentByIdForUpdate: jest.fn(),
  updateComment: jest.fn(),
  softDeleteComment: jest.fn(),
  restoreComment: jest.fn(),
  hideComment: jest.fn(),
  updateCommentVotes: jest.fn(),
  incrementCommentRepliesCount: jest.fn(),
  getCommentReplies: jest.fn(),
  listComments: jest.fn(),
  countReplies: jest.fn(),
  upsertVote: jest.fn(),
  getUserVote: jest.fn(),
  getUserVoteForUpdate: jest.fn(),
  removeVote: jest.fn(),
  subscribeToThread: jest.fn(),
  unsubscribeFromThread: jest.fn(),
  saveThread: jest.fn(),
  unsaveThread: jest.fn(),
  listThreads: jest.fn(),
  listQuizDiscussions: jest.fn(),
  listMyDiscussions: jest.fn(),
  listMyComments: jest.fn(),
  listMyUpvotedThreads: jest.fn(),
  listMyUpvotedComments: jest.fn(),
  listMyDiscussionSubscriptions: jest.fn(),
  listMySavedThreads: jest.fn(),
  listTrendingDiscussions: jest.fn(),
  listUnansweredDiscussions: jest.fn(),
  searchDiscussions: jest.fn(),
  listRelatedDiscussions: jest.fn(),
  listThreadParticipants: jest.fn(),
  createReport: jest.fn(),
  getReportById: jest.fn(),
  getUserExistingReport: jest.fn(),
  listReports: jest.fn(),
  reviewReport: jest.fn(),
  getUsernamesForUsers: jest.fn(),
  transactionally: jest.fn(),
  getCommentAuthor: jest.fn(),
  getThreadAuthor: jest.fn(),
  getReportReporter: jest.fn(),
  getReportTargetSummary: jest.fn(),
});

const createMockQuizPort = () => ({
  exists: jest.fn(),
});

const createMockUserPort = () => ({
  exists: jest.fn(),
});

const createMockEventBus = () => ({
  subscribe: jest.fn(() => jest.fn()),
  emitVoteRemoved: jest.fn(),
  emitCommentCreated: jest.fn(),
  emitCommentDeleted: jest.fn(),
  emitCommentHidden: jest.fn(),
  emitCommentMentioned: jest.fn(),
  emitCommentRestored: jest.fn(),
  emitThreadCreated: jest.fn(),
  emitThreadSolved: jest.fn(),
  emitThreadClosed: jest.fn(),
  emitThreadDeleted: jest.fn(),
  emitThreadReopened: jest.fn(),
  emitThreadRestored: jest.fn(),
  emitThreadHidden: jest.fn(),
  emitContentReported: jest.fn(),
  emitReportReviewed: jest.fn(),
});

describe('DiscussionService', () => {
  let service: DiscussionService;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockQuizPort: ReturnType<typeof createMockQuizPort>;
  let mockUserPort: ReturnType<typeof createMockUserPort>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  const mockUser = { sub: 'user-1', role: 'user' as const, email: 'user@test.com' };
  const mockThread = {
    threadId: 'thread-1',
    quizId: 'quiz-1',
    authorId: 'user-1',
    title: 'Test Thread',
    body: 'Test body',
    status: 'open' as const,
    isSolved: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    commentsCount: 0,
    votesCount: 0,
    upvotesCount: 0,
    downvotesCount: 0,
    solvedAt: null,
    solvedCommentId: null,
    solvedBy: null,
    author: { userId: 'user-1', username: 'testuser', displayName: null, avatarUrl: null },
  };

  beforeEach(async () => {
    mockRepo = createMockRepository();
    mockQuizPort = createMockQuizPort();
    mockUserPort = createMockUserPort();
    mockEventBus = createMockEventBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionService,
        { provide: 'DISCUSSION_REPOSITORY_PORT', useValue: mockRepo },
        { provide: 'QUIZ_EXISTENCE_PORT', useValue: mockQuizPort },
        { provide: 'USER_EXISTENCE_PORT', useValue: mockUserPort },
        { provide: 'DISCUSSION_DOMAIN_EVENT_BUS', useValue: mockEventBus },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<DiscussionService>(DiscussionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createThread', () => {
    it('should throw QuizNotFoundError when quiz does not exist', async () => {
      mockQuizPort.exists.mockResolvedValue(false);

      await expect(
        service.createThread({
          quizId: 'quiz-1',
          authorId: 'user-1',
          title: 'Test',
          body: 'Body',
        }),
      ).rejects.toThrow(QuizNotFoundError);
    });

    it('should create thread when quiz exists', async () => {
      mockQuizPort.exists.mockResolvedValue(true);
      mockRepo.createThread.mockResolvedValue(mockThread);

      const result = await service.createThread({
        quizId: 'quiz-1',
        authorId: 'user-1',
        title: 'Test',
        body: 'Body',
      });

      expect(result).toEqual(mockThread);
      expect(mockEventBus.emitThreadCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'discussion_thread_created',
          threadId: 'thread-1',
        }),
      );
    });
  });

  describe('createComment', () => {
    const createCommentParams = {
      threadId: 'thread-1',
      authorId: 'user-1',
      body: 'Test comment',
    };

    it('should throw ThreadNotFoundError when thread does not exist', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(null);
        return fn(null);
      });

      await expect(service.createComment(createCommentParams)).rejects.toThrow(ThreadNotFoundError);
    });

    it('should throw ThreadClosedError when thread is closed', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue({ ...mockThread, status: 'closed' });
        return fn(null);
      });

      await expect(service.createComment(createCommentParams)).rejects.toThrow(ThreadClosedError);
    });

    it('should throw ThreadNotActiveError when thread is deleted', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue({ ...mockThread, status: 'deleted' });
        return fn(null);
      });

      await expect(service.createComment(createCommentParams)).rejects.toThrow(ThreadNotActiveError);
    });

    it('should throw ReplyLimitExceededError when parent comment has max replies', async () => {
      const parentComment = {
        commentId: 'comment-1',
        threadId: 'thread-1',
        authorId: 'user-2',
        parentCommentId: null,
        body: 'Parent',
        status: 'visible' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        repliesCount: 0,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
        author: { userId: 'user-2', username: 'other', displayName: null, avatarUrl: null },
      };

      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        mockRepo.getCommentByIdForUpdate.mockResolvedValue(parentComment);
        mockRepo.countReplies.mockResolvedValue(MAX_REPLIES_PER_COMMENT);
        return fn(null);
      });

      await expect(
        service.createComment({
          ...createCommentParams,
          parentCommentId: 'comment-1',
        }),
      ).rejects.toThrow(ReplyLimitExceededError);
    });

    it('should throw CommentNotFoundError when parent comment does not exist', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        mockRepo.getCommentByIdForUpdate.mockResolvedValue(null);
        return fn(null);
      });

      await expect(
        service.createComment({
          ...createCommentParams,
          parentCommentId: 'nonexistent',
        }),
      ).rejects.toThrow(CommentNotFoundError);
    });

    it('should throw CommentThreadMismatchError when parent comment belongs to different thread', async () => {
      const parentComment = {
        commentId: 'comment-1',
        threadId: 'different-thread',
        authorId: 'user-2',
        parentCommentId: null,
        body: 'Parent',
        status: 'visible' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        repliesCount: 0,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
        author: { userId: 'user-2', username: 'other', displayName: null, avatarUrl: null },
      };

      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        mockRepo.getCommentByIdForUpdate.mockResolvedValue(parentComment);
        return fn(null);
      });

      await expect(
        service.createComment({
          ...createCommentParams,
          parentCommentId: 'comment-1',
        }),
      ).rejects.toThrow(CommentThreadMismatchError);
    });

    it('should create comment successfully', async () => {
      const comment = {
        commentId: 'comment-1',
        threadId: 'thread-1',
        authorId: 'user-1',
        parentCommentId: null,
        body: 'Test comment',
        status: 'visible' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        repliesCount: 0,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
        author: { userId: 'user-1', username: 'testuser', displayName: null, avatarUrl: null },
      };

      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        mockRepo.createComment.mockResolvedValue(comment);
        return fn(null);
      });

      const result = await service.createComment(createCommentParams);

      expect(result).toEqual(comment);
      expect(mockEventBus.emitCommentCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'comment_created',
          commentId: 'comment-1',
        }),
      );
    });
  });

  describe('vote', () => {
    it('should throw ThreadNotFoundError when thread does not exist', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(null);
        return fn(null);
      });

      await expect(
        service.vote({ userId: 'user-1', targetType: 'thread', targetId: 'thread-1', value: 'upvote' }),
      ).rejects.toThrow(ThreadNotFoundError);
    });

    it('should throw SelfVoteError when user votes on own content', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        return fn(null);
      });

      await expect(
        service.vote({ userId: 'user-1', targetType: 'thread', targetId: 'thread-1', value: 'upvote' }),
      ).rejects.toThrow(SelfVoteError);
    });

    it('should vote successfully', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue({ ...mockThread, authorId: 'other-user' });
        mockRepo.getUserVoteForUpdate.mockResolvedValue(null);
        return fn(null);
      });

      await expect(
        service.vote({ userId: 'user-1', targetType: 'thread', targetId: 'thread-1', value: 'upvote' }),
      ).resolves.not.toThrow();
    });
  });

  describe('removeVote', () => {
    it('should emit VoteRemovedEvent after successful vote removal', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue({ ...mockThread, authorId: 'other-user' });
        mockRepo.getUserVoteForUpdate.mockResolvedValue('upvote');
        return fn(null);
      });

      await service.removeVote({
        userId: 'user-1',
        targetType: 'thread',
        targetId: 'thread-1',
      });

      expect(mockEventBus.emitVoteRemoved).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'vote_removed',
          userId: 'user-1',
          targetType: 'thread',
          targetId: 'thread-1',
        }),
      );
    });
  });

  describe('subscribeToThread', () => {
    it('should throw ThreadNotFoundError when thread does not exist', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(null);
        return fn(null);
      });

      await expect(service.subscribeToThread('user-1', 'thread-1')).rejects.toThrow(ThreadNotFoundError);
    });

    it('should throw ThreadNotActiveError when thread is closed', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue({ ...mockThread, status: 'closed' });
        return fn(null);
      });

      await expect(service.subscribeToThread('user-1', 'thread-1')).rejects.toThrow(ThreadNotActiveError);
    });

    it('should subscribe successfully', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        return fn(null);
      });

      await expect(service.subscribeToThread('user-1', 'thread-1')).resolves.toEqual({ success: true });
    });
  });

  describe('saveThread', () => {
    it('should throw ThreadNotFoundError when thread does not exist', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(null);
        return fn(null);
      });

      await expect(service.saveThread('user-1', 'thread-1')).rejects.toThrow(ThreadNotFoundError);
    });

    it('should throw ThreadNotActiveError when thread is hidden', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue({ ...mockThread, status: 'hidden' });
        return fn(null);
      });

      await expect(service.saveThread('user-1', 'thread-1')).rejects.toThrow(ThreadNotActiveError);
    });

    it('should save thread successfully', async () => {
      mockRepo.transactionally.mockImplementation(async (fn) => {
        mockRepo.getThreadByIdForUpdate.mockResolvedValue(mockThread);
        return fn(null);
      });

      await expect(service.saveThread('user-1', 'thread-1')).resolves.toEqual({ success: true });
    });
  });

  describe('closeThread', () => {
    it('should throw ThreadNotFoundError when thread does not exist', async () => {
      mockRepo.getThreadById.mockResolvedValue(null);

      await expect(service.closeThread('thread-1', 'user-1')).rejects.toThrow(ThreadNotFoundError);
    });

    it('should throw ThreadForbiddenError when non-author tries to close', async () => {
      mockRepo.getThreadById.mockResolvedValue(mockThread);

      await expect(service.closeThread('thread-1', 'other-user')).rejects.toThrow(ThreadForbiddenError);
    });

    it('should close thread successfully', async () => {
      mockRepo.getThreadById.mockResolvedValue(mockThread);

      await service.closeThread('thread-1', 'user-1');

      expect(mockRepo.updateThreadStatus).toHaveBeenCalledWith({
        threadId: 'thread-1',
        status: 'closed',
      });
      expect(mockEventBus.emitThreadClosed).toHaveBeenCalled();
    });
  });

  describe('deleteThread', () => {
    it('should throw ThreadForbiddenError when non-author tries to delete', async () => {
      mockRepo.getThreadById.mockResolvedValue(mockThread);

      await expect(service.deleteThread('thread-1', 'other-user')).rejects.toThrow(ThreadForbiddenError);
    });

    it('should delete thread successfully with cascade', async () => {
      mockRepo.getThreadById.mockResolvedValue(mockThread);
      mockRepo.transactionally.mockImplementation(async (fn) => fn(null));

      await service.deleteThread('thread-1', 'user-1');

      expect(mockRepo.softDeleteCommentsByThread).toHaveBeenCalledWith('thread-1', null);
      expect(mockRepo.softDeleteThread).toHaveBeenCalled();
      expect(mockEventBus.emitThreadDeleted).toHaveBeenCalled();
    });
  });
});
