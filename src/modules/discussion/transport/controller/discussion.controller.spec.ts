/**
 * DiscussionController unit tests.
 *
 * Tests the controller endpoints:
 *   - GET /trending — list trending discussions
 *   - GET /unanswered — list unanswered discussions
 *   - GET /search — search discussions
 *   - GET /threads — list threads
 *   - POST /threads — create thread
 *   - POST /threads/:threadId/vote — vote
 *   - DELETE /threads/:threadId/vote — remove vote
 *   - POST /threads/:threadId/subscribe — subscribe
 *   - POST /threads/:threadId/save — save thread
 *   - POST /threads/:threadId/report — report
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { DiscussionController } from './discussion.controller';
import { DiscussionApplicationService } from '@/modules/discussion/application/discussion-application.service';
import { DiscussionPresenter } from '../presenters/discussion.presenter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockService = (): any => ({
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
  getPublicDiscussionProfile: jest.fn(),
  createThread: jest.fn(),
  updateThread: jest.fn(),
  deleteThread: jest.fn(),
  restoreThread: jest.fn(),
  hideThread: jest.fn(),
  unhideThread: jest.fn(),
  closeThread: jest.fn(),
  reopenThread: jest.fn(),
  markThreadAsSolved: jest.fn(),
  unmarkThreadAsSolved: jest.fn(),
  getThread: jest.fn(),
  vote: jest.fn(),
  removeVote: jest.fn(),
  subscribeToThread: jest.fn(),
  unsubscribeFromThread: jest.fn(),
  saveThread: jest.fn(),
  unsaveThread: jest.fn(),
  report: jest.fn(),
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
  restoreComment: jest.fn(),
  hideComment: jest.fn(),
  getComment: jest.fn(),
  listComments: jest.fn(),
  listReports: jest.fn(),
  reviewReport: jest.fn(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockPresenter = (): any => ({
  listThreads: jest.fn((x: unknown) => x),
  createThread: jest.fn((x: unknown) => x),
});

describe('DiscussionController', () => {
  let controller: DiscussionController;
  let mockService: ReturnType<typeof createMockService>;
  let mockPresenter: ReturnType<typeof createMockPresenter>;

  const mockUser = { sub: 'user-1', role: 'user' as const, email: 'user@test.com' };

  beforeEach(async () => {
    mockService = createMockService();
    mockPresenter = createMockPresenter();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscussionController],
      imports: [ThrottlerModule.forRoot()],
      providers: [
        { provide: DiscussionApplicationService, useValue: mockService },
        { provide: DiscussionPresenter, useValue: mockPresenter },
        {
          provide: 'SESSION_SERVICE',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<DiscussionController>(DiscussionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /trending', () => {
    it('should list trending discussions', async () => {
      const mockResult = {
        items: [],
        pagination: { limit: 20, hasNextPage: false, nextCursor: null },
      };

      mockService.listTrendingDiscussions.mockResolvedValue(mockResult);

      const result = await controller.listTrendingDiscussions({ limit: 20 });

      expect(result).toBeDefined();
      expect(mockService.listTrendingDiscussions).toHaveBeenCalledWith({
        limit: 20,
        cursor: null,
      });
    });

    it('should handle cursor parameter', async () => {
      mockService.listTrendingDiscussions.mockResolvedValue({
        items: [],
        pagination: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      await controller.listTrendingDiscussions({ limit: 20, cursor: 'someCursor' });

      expect(mockService.listTrendingDiscussions).toHaveBeenCalledWith({
        limit: 20,
        cursor: expect.any(Object),
      });
    });
  });

  describe('GET /unanswered', () => {
    it('should list unanswered discussions', async () => {
      mockService.listUnansweredDiscussions.mockResolvedValue({
        items: [],
        pagination: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      const result = await controller.listUnansweredDiscussions({ limit: 20 });

      expect(result).toBeDefined();
      expect(mockService.listUnansweredDiscussions).toHaveBeenCalledWith({
        limit: 20,
        cursor: null,
      });
    });
  });

  describe('GET /search', () => {
    it('should search discussions', async () => {
      mockService.searchDiscussions.mockResolvedValue({
        items: [],
        pagination: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      const result = await controller.searchDiscussions({ q: 'test', limit: 20 });

      expect(result).toBeDefined();
      expect(mockService.searchDiscussions).toHaveBeenCalledWith({
        q: 'test',
        limit: 20,
        cursor: null,
      });
    });
  });

  describe('GET /threads', () => {
    it('should list threads', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        meta: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      const result = await controller.listThreads(mockUser, { limit: 20 });

      expect(result).toBeDefined();
      expect(mockService.listThreads).toHaveBeenCalled();
    });

    it('should filter by quizId', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        meta: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      await controller.listThreads(mockUser, { limit: 20, quizId: 'quiz-1' });

      expect(mockService.listThreads).toHaveBeenCalled();
    });

    it('should filter by authorId', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        meta: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      await controller.listThreads(mockUser, { limit: 20, authorId: 'user-2' });

      expect(mockService.listThreads).toHaveBeenCalled();
    });

    it('should pass cursor through', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        meta: { limit: 20, hasNextPage: false, nextCursor: null },
      });

      await controller.listThreads(mockUser, { limit: 20, cursor: 'cursor123' });

      expect(mockService.listThreads).toHaveBeenCalled();
    });
  });

  describe('POST /threads', () => {
    it('should create thread', async () => {
      const mockThread = { threadId: 'thread-1', title: 'Test', body: 'Body' };
      mockService.createThread.mockResolvedValue(mockThread);

      const result = await controller.createThread(mockUser, {
        quizId: 'quiz-1',
        title: 'Test',
        body: 'Body',
      });

      expect(result).toBeDefined();
      expect(mockService.createThread).toHaveBeenCalled();
    });
  });

  describe('POST /threads/:threadId/vote', () => {
    it('should vote on thread', async () => {
      mockService.vote.mockResolvedValue(undefined);

      await controller.vote(mockUser, {
        targetType: 'thread',
        targetId: 'thread-1',
        value: 'upvote',
      });

      expect(mockService.vote).toHaveBeenCalled();
    });
  });

  describe('DELETE /threads/:threadId/vote', () => {
    it('should remove vote from thread', async () => {
      mockService.removeVote.mockResolvedValue(undefined);

      await controller.removeVote(mockUser, { targetType: 'thread', targetId: 'thread-1' });

      expect(mockService.removeVote).toHaveBeenCalled();
    });
  });

  describe('POST /threads/:threadId/subscribe', () => {
    it('should subscribe to thread', async () => {
      mockService.subscribeToThread.mockResolvedValue({ success: true });

      const result = await controller.subscribeToThread(mockUser, 'thread-1');

      expect(result).toEqual({ success: true });
      expect(mockService.subscribeToThread).toHaveBeenCalled();
    });
  });

  describe('POST /threads/:threadId/save', () => {
    it('should save thread', async () => {
      mockService.saveThread.mockResolvedValue({ success: true });

      const result = await controller.saveThread(mockUser, 'thread-1');

      expect(result).toEqual({ success: true });
      expect(mockService.saveThread).toHaveBeenCalled();
    });
  });

  describe('POST /threads/:threadId/report', () => {
    it('should report thread', async () => {
      mockService.report.mockResolvedValue(undefined);

      await controller.report(mockUser, {
        targetType: 'thread',
        targetId: 'thread-1',
        reason: 'spam',
        details: 'This is spam',
      });

      expect(mockService.report).toHaveBeenCalled();
    });
  });
});
