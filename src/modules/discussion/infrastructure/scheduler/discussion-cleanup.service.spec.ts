/**
 * DiscussionCleanupService unit tests.
 *
 * Tests the cleanup scheduler methods:
 *   - `cleanupOrphanedVotes` — removes votes on deleted threads/comments
 *   - `reconcileDiscussionCounts` — reconciles denormalized counters
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { DiscussionCleanupService } from './discussion-cleanup.service';

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
  delete: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
});

describe('DiscussionCleanupService', () => {
  let service: DiscussionCleanupService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionCleanupService,
        { provide: 'DRIZZLE', useValue: mockDb },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<DiscussionCleanupService>(DiscussionCleanupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupOrphanedVotes', () => {
    it('should return early when no orphaned votes exist', async () => {
      // Mock the internal find methods by overriding the execute calls
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] }) // orphaned thread votes
        .mockResolvedValueOnce({ rows: [] }); // orphaned comment votes

      await service.cleanupOrphanedVotes();

      // Should have logged info about starting and finding no orphans
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'discussion_cleanup_started' }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'discussion_cleanup_no_orphans_found' }),
      );
    });

    it('should find orphaned thread votes', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ voteId: 'vote-1' }, { voteId: 'vote-2' }] })
        .mockResolvedValueOnce({ rows: [] });

      // Mock delete chain
      const mockDelete = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ voteId: 'vote-1' }, { voteId: 'vote-2' }]),
        }),
      });
      mockDb.delete = mockDelete;

      await service.cleanupOrphanedVotes();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_cleanup_completed',
          orphanedThreadVotes: 2,
        }),
      );
    });

    it('should find orphaned comment votes', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ voteId: 'vote-3' }] });

      const mockDelete = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ voteId: 'vote-3' }]),
        }),
      });
      mockDb.delete = mockDelete;

      await service.cleanupOrphanedVotes();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_cleanup_completed',
          orphanedCommentVotes: 1,
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('Database error'));

      await expect(service.cleanupOrphanedVotes()).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_cleanup_failed',
          error: 'Database error',
        }),
      );
    });
  });

  describe('reconcileDiscussionCounts', () => {
    it('should reconcile discussion counts', async () => {
      const mockTransaction = jest.fn().mockImplementation(async (fn) => {
        await fn(mockDb);
        return { threads: 2, replies: 1 };
      });
      mockDb.transaction = mockTransaction;
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ 1: 1 }, { 1: 1 }] })
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await service.reconcileDiscussionCounts();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_counts_reconcile_complete',
          threadsUpdated: 2,
          repliesUpdated: 1,
        }),
      );
    });

    it('should handle empty reconciliation results', async () => {
      const mockTransaction = jest.fn().mockImplementation(async (fn) => {
        await fn(mockDb);
        return { threads: 0, replies: 0 };
      });
      mockDb.transaction = mockTransaction;
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.reconcileDiscussionCounts();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_counts_reconcile_complete',
          threadsUpdated: 0,
          repliesUpdated: 0,
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.reconcileDiscussionCounts()).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_counts_reconcile_failed',
          error: 'Transaction failed',
        }),
      );
    });

    it('should update both threads and comments in same transaction', async () => {
      const mockTransaction = jest.fn().mockImplementation(async (fn) => {
        await fn(mockDb);
        return { threads: 2, replies: 1 };
      });
      mockDb.transaction = mockTransaction;
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ 1: 1 }, { 1: 1 }] })
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] });

      await service.reconcileDiscussionCounts();

      // Transaction should be called once
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // Both SQL updates should be executed within the transaction
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });
  });
});
