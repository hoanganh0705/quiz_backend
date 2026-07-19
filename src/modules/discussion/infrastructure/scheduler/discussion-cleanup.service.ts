/**
 * Discussion Soft-Delete Cleanup Scheduler
 *
 * Runs daily to remove orphaned votes left behind after threads or comments
 * are soft-deleted. Votes to deleted threads/comments are no longer meaningful
 * but still occupy rows and pollute up/downvote counts on the aggregate
 * `discussion_votes` table.
 *
 * Cleanup strategy:
 * 1. Find vote rows whose target thread has been soft-deleted (deletedAt IS NOT NULL).
 * 2. Find vote rows whose target comment has been soft-deleted.
 * 3. Hard-delete those votes in batches.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { discussionVotes, discussionComments, discussionThreads } from '@/core/database/schema';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

@Injectable()
export class DiscussionCleanupService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(DiscussionCleanupService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Runs daily at 3 AM to clean up orphaned votes.
   * Chosen off-peak to minimize impact on user-facing traffic.
   */
  @Cron('0 3 * * *')
  async cleanupOrphanedVotes(): Promise<void> {
    const nowIso = new Date().toISOString();
    this.logger.info({ event: 'discussion_cleanup_started', cleanedAt: nowIso });

    try {
      const [orphanedThreadVotes, orphanedCommentVotes] = await Promise.all([
        this.findOrphanedThreadVotes(),
        this.findOrphanedCommentVotes(),
      ]);

      const totalOrphaned =
        orphanedThreadVotes.voteIds.length + orphanedCommentVotes.voteIds.length;

      if (totalOrphaned === 0) {
        this.logger.info({ event: 'discussion_cleanup_no_orphans_found', cleanedAt: nowIso });
        return;
      }

      const deleted = await this.deleteOrphanedVotes([
        ...orphanedThreadVotes.voteIds,
        ...orphanedCommentVotes.voteIds,
      ]);

      this.logger.info({
        event: 'discussion_cleanup_completed',
        cleanedAt: nowIso,
        orphanedThreadVotes: orphanedThreadVotes.voteIds.length,
        orphanedCommentVotes: orphanedCommentVotes.voteIds.length,
        deletedVotes: deleted,
      });
    } catch (error) {
      this.logger.error({
        event: 'discussion_cleanup_failed',
        cleanedAt: nowIso,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async findOrphanedThreadVotes(): Promise<{ voteIds: string[] }> {
    const rows = await this.db
      .select({ voteId: discussionVotes.voteId })
      .from(discussionVotes)
      .innerJoin(discussionThreads, eq(discussionVotes.targetId, discussionThreads.threadId))
      .where(and(eq(discussionVotes.targetType, 'thread'), isNotNull(discussionThreads.deletedAt)));

    return { voteIds: rows.map((r) => r.voteId) };
  }

  private async findOrphanedCommentVotes(): Promise<{ voteIds: string[] }> {
    const rows = await this.db
      .select({ voteId: discussionVotes.voteId })
      .from(discussionVotes)
      .innerJoin(discussionComments, eq(discussionVotes.targetId, discussionComments.commentId))
      .where(
        and(eq(discussionVotes.targetType, 'comment'), isNotNull(discussionComments.deletedAt)),
      );

    return { voteIds: rows.map((r) => r.voteId) };
  }

  private async deleteOrphanedVotes(voteIds: string[]): Promise<number> {
    if (voteIds.length === 0) return 0;

    const BATCH_SIZE = 1000;
    let totalDeleted = 0;

    for (let i = 0; i < voteIds.length; i += BATCH_SIZE) {
      const batch = voteIds.slice(i, i + BATCH_SIZE);
      const result = await this.db
        .delete(discussionVotes)
        .where(inArray(discussionVotes.voteId, batch))
        .returning({ voteId: discussionVotes.voteId });

      totalDeleted += result.length;
    }

    return totalDeleted;
  }

  /**
   * Runs daily at 3:30 AM to reconcile the denormalized counters
   * `discussion_threads.comments_count` and
   * `discussion_comments.replies_count` with the actual rows.
   *
   * Scheduled 30 minutes after `cleanupOrphanedVotes` (3 AM) so the
   * orphan-vote cleanup can't race with the counter recompute on shared
   * rows. Lives before any analytics path runs (analytics scheduler is
   * at 2 AM/3 AM for quiz-related work; this slot is otherwise empty).
   *
   * See `docs/plans/denormalized-counters-audit.md` — Fix #2, last bullet.
   */
  @Cron('30 3 * * *')
  async reconcileDiscussionCounts(): Promise<void> {
    this.logger.info({ event: 'discussion_counts_reconcile_start' });

    try {
      // Mirror the SQL in `0009_reconcile_discussion_counts.sql`: each
      // pass is itself idempotent (IS DISTINCT FROM) and either pass can
      // be re-run without effect. The whole job is one transactional
      // batch so partial application isn't possible.
      const result = await this.db.transaction(async (tx) => {
        const threads = await tx.execute(sql`
          UPDATE discussion_threads AS t
          SET comments_count = counts.cnt,
              updated_at    = NOW()
          FROM (
            SELECT thread_id, COUNT(*)::int AS cnt
            FROM discussion_comments
            WHERE status = 'visible'
            GROUP BY thread_id
          ) AS counts
          WHERE t.thread_id = counts.thread_id
            AND t.comments_count IS DISTINCT FROM counts.cnt
          RETURNING 1
        `);

        const replies = await tx.execute(sql`
          UPDATE discussion_comments AS c
          SET replies_count = counts.cnt,
              updated_at   = NOW()
          FROM (
            SELECT parent_comment_id AS comment_id, COUNT(*)::int AS cnt
            FROM discussion_comments
            WHERE status = 'visible'
              AND parent_comment_id IS NOT NULL
            GROUP BY parent_comment_id
          ) AS counts
          WHERE c.comment_id = counts.comment_id
            AND c.replies_count IS DISTINCT FROM counts.cnt
          RETURNING 1
        `);

        return {
          threads: (threads.rows ?? []).length,
          replies: (replies.rows ?? []).length,
        };
      });

      this.logger.info({
        event: 'discussion_counts_reconcile_complete',
        threadsUpdated: result.threads,
        repliesUpdated: result.replies,
      });
    } catch (error) {
      this.logger.error({
        event: 'discussion_counts_reconcile_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
