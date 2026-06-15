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
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

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
}
