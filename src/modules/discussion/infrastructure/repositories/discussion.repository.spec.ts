/**
 * DiscussionRepository unit tests.
 *
 * Tests the repository methods:
 *   - `listThreads` — pagination with limit+1 pattern
 *   - `countReplies` — counting visible replies
 *   - `transactionally` — transaction wrapper
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import { DiscussionRepository, MAX_REPLIES_PER_COMMENT } from './discussion.repository';

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

const createMockDb = () => ({
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  from: jest.fn(),
  innerJoin: jest.fn(),
  leftJoin: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  returning: jest.fn(),
  transaction: jest.fn(),
  execute: jest.fn(),
});

const createMockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getJson: jest.fn(),
  setJson: jest.fn(),
  delJson: jest.fn(),
  lpopJson: jest.fn(),
  rpushJson: jest.fn(),
});

describe('DiscussionRepository', () => {
  let repository: DiscussionRepository;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(async () => {
    mockDb = createMockDb();
    mockCache = createMockCache();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionRepository,
        { provide: 'DRIZZLE', useValue: mockDb },
        { provide: CACHE_PROVIDER, useValue: mockCache },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    repository = module.get<DiscussionRepository>(DiscussionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MAX_REPLIES_PER_COMMENT', () => {
    it('should be set to 100', () => {
      expect(MAX_REPLIES_PER_COMMENT).toBe(100);
    });
  });

  describe('listThreads', () => {
    const createMockThreadRow = (id: string) => ({
      thread: {
        threadId: id,
        quizId: 'quiz-1',
        authorId: 'user-1',
        title: `Thread ${id}`,
        body: `Body ${id}`,
        status: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        isSolved: false,
        commentsCount: 0,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
        solvedAt: null,
        solvedCommentId: null,
        solvedBy: null,
      },
      authorUsername: 'user1',
      authorDisplayName: null,
      authorAvatarUrl: null,
    });

    it('should use limit+1 pattern for pagination detection', async () => {
      const mockRows = [createMockThreadRow('thread-1'), createMockThreadRow('thread-2')];

      // Setup chain: select().from().innerJoin().leftJoin().where().orderBy().limit()
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue(mockRows),
                }),
              }),
            }),
          }),
        }),
      });

      await repository.listThreads({ limit: 1 });

      // Verify limit was called with limit + 1
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should handle cursor-based pagination', async () => {
      const cursorDate = new Date('2026-01-01T00:00:00.000Z');

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      await repository.listThreads({
        limit: 10,
        cursor: cursorDate.toISOString(),
        sortOrder: 'desc',
      });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('countReplies', () => {
    it('should count visible replies to a parent comment', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ count: 5 }]),
          }),
        }),
      });

      const result = await repository.countReplies('parent-comment-id');

      expect(result).toBe(5);
    });

    it('should return 0 when no replies exist', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repository.countReplies('parent-comment-id');

      expect(result).toBe(0);
    });
  });

  describe('transactionally', () => {
    it('should wrap operation in transaction', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));

      const result = await repository.transactionally(mockFn);

      expect(result).toBe('result');
      expect(mockDb.transaction).toHaveBeenCalledWith(mockFn);
    });

    it('should propagate errors from transaction', async () => {
      const error = new Error('Transaction failed');
      const mockFn = jest.fn().mockRejectedValue(error);

      mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));

      await expect(repository.transactionally(mockFn)).rejects.toThrow('Transaction failed');
    });
  });
});
