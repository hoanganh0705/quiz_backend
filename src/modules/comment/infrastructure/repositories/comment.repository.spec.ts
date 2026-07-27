/**
 * CommentRepository unit tests.
 *
 * Tests the repository methods:
 *   - `countReplies` — counting visible replies
 *   - `transactionally` — transaction wrapper
 *   - `reconcileCounters` — idempotent counter recompute
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import { CommentRepository } from './comment.repository';

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
  for: jest.fn(),
  onConflictDoUpdate: jest.fn(),
});

describe('CommentRepository', () => {
  let repository: CommentRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentRepository,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: CACHE_PROVIDER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    repository = module.get<CommentRepository>(CommentRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('countReplies', () => {
    it('counts visible replies to a parent comment', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const result = await repository.countReplies('parent-comment-id');

      expect(result).toBe(5);
    });

    it('returns 0 when no replies exist', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await repository.countReplies('parent-comment-id');

      expect(result).toBe(0);
    });
  });

  describe('transactionally', () => {
    it('wraps operation in transaction', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));

      const result = await repository.transactionally(mockFn);

      expect(result).toBe('result');
      expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('propagates errors from transaction', async () => {
      const error = new Error('Transaction failed');
      const mockFn = jest.fn().mockRejectedValue(error);

      mockDb.transaction.mockImplementation(async (fn) => fn(mockDb));

      await expect(repository.transactionally(mockFn)).rejects.toThrow('Transaction failed');
    });
  });

  describe('reconcileCounters', () => {
    it('returns idempotent empty result when no rows need updating', async () => {
      mockDb.transaction.mockImplementation(async (fn) => {
        const tx = {
          execute: jest.fn().mockResolvedValue({ rows: [] }),
        };
        return fn(tx);
      });

      const result = await repository.reconcileCounters();

      expect(result).toEqual({ comments: 0, replies: 0 });
    });

    it('returns the count of replies reconciled', async () => {
      mockDb.transaction.mockImplementation(async (fn) => {
        const tx = {
          execute: jest.fn().mockResolvedValue({ rows: [{}, {}, {}] }),
        };
        return fn(tx);
      });

      const result = await repository.reconcileCounters();

      expect(result.replies).toBe(3);
    });
  });
});
