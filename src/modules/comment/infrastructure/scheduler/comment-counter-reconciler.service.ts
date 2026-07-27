/**
 * Comment Counter Reconciler (Phase 9.6)
 *
 * Runs daily at 3:30 AM to recompute the denormalized `replies_count`
 * aggregate on `comments` from the underlying rows. The
 * Q/A era had a top-level `threads.comments_count` counter
 * that the comment module deletes; the per-comment `replies_count`
 * is the only remaining counter that needs reconciliation.
 *
 * Scheduling: 3:30 AM keeps it 30 minutes after the analytics
 * quarantine scheduler so neither job can race the other on
 * shared rows.
 *
 * Counter mode: each update is itself idempotent (`IS DISTINCT FROM`),
 * so re-running the job is safe.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  COMMENT_REPOSITORY_PORT,
  type CommentRepositoryPort,
} from '../../domain/ports/comment-repository.port';

@Injectable()
export class CommentCounterReconcilerService {
  constructor(
    @Inject(COMMENT_REPOSITORY_PORT)
    private readonly repo: CommentRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(CommentCounterReconcilerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Runs daily at 3:30 AM. The repository implementation does the
   * heavy lifting (single transactional batch of idempotent updates).
   * The scheduler only logs the result.
   */
  @Cron('30 3 * * *')
  async reconcileCommentCounters(): Promise<void> {
    this.logger.info({ event: 'comment_counts_reconcile_start' });
    try {
      const result = await this.repo.reconcileCounters();
      this.logger.info({
        event: 'comment_counts_reconcile_complete',
        repliesUpdated: result.replies,
      });
    } catch (error) {
      this.logger.error({
        event: 'comment_counts_reconcile_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
