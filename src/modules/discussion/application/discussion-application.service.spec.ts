/**
 * DiscussionApplicationService unit tests.
 *
 * Tests the application service methods:
 *   - `listThreads` — pagination with cursor
 *   - `listQuizDiscussions` — quiz-specific discussions
 *   - `searchDiscussions` — full-text search
 *   - `vote` — voting on threads/comments
 *   - `removeVote` — removing a vote
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { CursorPagination } from '@/common/responses/pagination';
import { DiscussionApplicationService } from './discussion-application.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDiscussionService = (): any => ({
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
const mockPresenter = (): any => ({
  listThreads: jest.fn((x: unknown) => x),
  createThread: jest.fn((x: unknown) => x),
});

describe('DiscussionApplicationService', () => {
  let service: DiscussionApplicationService;
  let mockService: ReturnType<typeof mockDiscussionService>;
  let mockPresenterInstance: ReturnType<typeof mockPresenter>;

  beforeEach(async () => {
    mockService = mockDiscussionService();
    mockPresenterInstance = mockPresenter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionApplicationService,
        {
          provide: 'DISCUSSION_SERVICE',
          useValue: mockService,
        },
        {
          provide: 'DISCUSSION_PRESENTER',
          useValue: mockPresenterInstance,
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscussionApplicationService>(DiscussionApplicationService);
  });

  const mockUser = { sub: 'user-1', role: 'user' as const, email: 'user@test.com' };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listThreads', () => {
    it('should return paginated results with cursor', async () => {
      const mockThreads = [
        {
          threadId: 'thread-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          author: { userId: 'user-1', username: 'user1' },
        },
        {
          threadId: 'thread-2',
          createdAt: '2026-01-02T00:00:00.000Z',
          author: { userId: 'user-2', username: 'user2' },
        },
      ];

      mockService.listThreads.mockResolvedValue({
        items: mockThreads,
        hasNextPage: true,
      });

      const result = await service.listThreads({ limit: 2 });

      expect(result.items).toEqual(mockThreads);
      expect((result.pagination as CursorPagination).hasNextPage).toBe(true);
      expect((result.pagination as CursorPagination).nextCursor).toBe('2026-01-02T00:00:00.000Z');
    });

    it('should not set nextCursor when hasNextPage is false', async () => {
      const mockThreads = [
        {
          threadId: 'thread-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          author: { userId: 'user-1', username: 'user1' },
        },
      ];

      mockService.listThreads.mockResolvedValue({
        items: mockThreads,
        hasNextPage: false,
      });

      const result = await service.listThreads({ limit: 2 });

      expect(result.items).toEqual(mockThreads);
      expect((result.pagination as CursorPagination).hasNextPage).toBe(false);
      expect((result.pagination as CursorPagination).nextCursor).toBeNull();
    });

    it('should return empty items when no threads exist', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        hasNextPage: false,
      });

      const result = await service.listThreads({ limit: 10 });

      expect(result.items).toEqual([]);
      expect((result.pagination as CursorPagination).hasNextPage).toBe(false);
      expect((result.pagination as CursorPagination).nextCursor).toBeNull();
    });

    it('should use default limit of 20 when not specified', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        hasNextPage: false,
      });

      await service.listThreads({});

      expect(mockService.listThreads).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20 }),
      );
    });

    it('should forward cursor parameter', async () => {
      mockService.listThreads.mockResolvedValue({
        items: [],
        hasNextPage: false,
      });

      const cursor = '2026-01-01T00:00:00.000Z';
      await service.listThreads({ cursor });

      expect(mockService.listThreads).toHaveBeenCalledWith(
        expect.objectContaining({ cursor }),
      );
    });
  });

  describe('listQuizDiscussions', () => {
    it('should return paginated results with serialized cursor', async () => {
      mockService.listQuizDiscussions.mockResolvedValue({
        items: [],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });

      const result = await service.listQuizDiscussions('quiz-1', { limit: 20 });

      expect(result.pagination.limit).toBe(20);
      expect((result.pagination as CursorPagination).hasNextPage).toBe(false);
      expect((result.pagination as CursorPagination).nextCursor).toBeNull();
    });
  });

  describe('searchDiscussions', () => {
    it('should return search results', async () => {
      const searchResults = {
        items: [],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      };

      mockService.searchDiscussions.mockResolvedValue(searchResults);

      const result = await service.searchDiscussions({ q: 'test query', limit: 20 });

      expect(result.items).toEqual([]);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(mockService.searchDiscussions).toHaveBeenCalledWith({
        q: 'test query',
        limit: 20,
        cursor: null,
      });
    });
  });

  describe('createThread', () => {
    it('should create thread and return result', async () => {
      const mockUser = { sub: 'user-1', role: 'user' as const, email: 'user@test.com' };
      const mockThread = {
        threadId: 'thread-1',
        title: 'Test Thread',
        body: 'Test body',
        quizId: 'quiz-1',
      };

      mockService.createThread.mockResolvedValue(mockThread);

      const result = await service.createThread(mockUser, 'quiz-1', 'Test Thread', 'Test body');

      expect(result).toEqual(mockThread);
      expect(mockService.createThread).toHaveBeenCalledWith(mockUser, 'quiz-1', 'Test Thread', 'Test body');
    });
  });

  describe('vote', () => {
    it('should handle upvote', async () => {
      mockService.vote.mockResolvedValue(undefined);

      await service.vote(mockUser, 'thread', 'thread-1', 'upvote');

      expect(mockService.vote).toHaveBeenCalled();
    });

    it('should handle downvote', async () => {
      mockService.vote.mockResolvedValue(undefined);

      await service.vote(mockUser, 'thread', 'thread-1', 'downvote');

      expect(mockService.vote).toHaveBeenCalled();
    });
  });

  describe('removeVote', () => {
    it('should remove vote', async () => {
      mockService.removeVote.mockResolvedValue(undefined);

      await service.removeVote(mockUser, 'thread', 'thread-1');

      expect(mockService.removeVote).toHaveBeenCalled();
    });
  });
});
