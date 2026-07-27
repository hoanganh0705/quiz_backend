/**
 * CommentCounterReconcilerService unit tests.
 *
 * The reconciler is intentionally thin: it just delegates to the
 * repository's idempotent `reconcileCounters` and logs the result.
 * The tests verify:
 *   - the success log records the reply-count delta,
 *   - repository failures are caught and recorded as error logs
 *     without propagating (the cron schedule must keep firing
 *     tomorrow).
 *
 * The `@Cron` decorator is irrelevant in unit tests; we invoke
 * `reconcileCommentCounters` directly.
 */

import { CommentCounterReconcilerService } from './comment-counter-reconciler.service';
import type { CommentRepositoryPort } from '../../domain/ports/comment-repository.port';

describe('CommentCounterReconcilerService', () => {
  let service: CommentCounterReconcilerService;
  let reconcileCounters: jest.Mock;
  let logger: { info: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    reconcileCounters = jest.fn();
    logger = { info: jest.fn(), error: jest.fn() };

    service = new CommentCounterReconcilerService(
      { reconcileCounters } as unknown as CommentRepositoryPort,
      {} as never,
      logger as unknown as never,
    );
  });

  it('logs the start and the result on success', async () => {
    reconcileCounters.mockResolvedValueOnce({ comments: 0, replies: 12 });

    await service.reconcileCommentCounters();

    expect(reconcileCounters).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({ event: 'comment_counts_reconcile_start' });
    expect(logger.info).toHaveBeenCalledWith({
      event: 'comment_counts_reconcile_complete',
      repliesUpdated: 12,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('swallows repository failures and logs them as errors', async () => {
    const error = new Error('boom');
    reconcileCounters.mockRejectedValueOnce(error);

    await expect(service.reconcileCommentCounters()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith({
      event: 'comment_counts_reconcile_failed',
      error: 'boom',
    });
    // Start log still fires.
    expect(logger.info).toHaveBeenCalledWith({ event: 'comment_counts_reconcile_start' });
  });

  it('serializes non-Error throwables in the failure log', async () => {
    reconcileCounters.mockRejectedValueOnce('plain string');

    await expect(service.reconcileCommentCounters()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith({
      event: 'comment_counts_reconcile_failed',
      error: 'plain string',
    });
  });
});