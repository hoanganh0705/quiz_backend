import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  discussionComments,
  discussionCommentReports,
  discussionCommentVotes,
  userProfiles,
  users,
} from '@/core/database/schema';
import {
  commentAuthorForView,
  multiReplyScan,
  paginatedCommentScan,
  reportScan,
  topLevelCommentScan,
} from './comment.repository.scans';
import {
  COMMENT_REPOSITORY_PORT,
  type CommentRepositoryPort,
  type Db,
  type ListCommentsParamsForPort,
} from '../../domain/ports/comment-repository.port';
import { MAX_REPLIES_PER_COMMENT } from '../../domain/constants';
import type {
  AuthorView,
  CommentView,
  CommentWithRepliesView,
  ListMyCommentsParams,
  ListReportsParams,
  MyCommentView,
  ReportView,
  ReviewReportParams,
  VoteValue,
} from '../../domain/types';
import { and, eq, inArray, isNull, sql, count } from 'drizzle-orm';

@Injectable()
export class CommentRepository implements CommentRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ─── Comments ─────────────────────────────────────────────────────────────

  async createComment(
    params: Parameters<CommentRepositoryPort['createComment']>[0],
    tx?: Db,
  ): Promise<CommentView> {
    const client = this.asDrizzle(tx);
    const [comment] = await client
      .insert(discussionComments)
      .values({
        quizId: params.quizId,
        authorId: params.authorId,
        parentCommentId: params.parentCommentId ?? null,
        body: params.body,
      })
      .returning();

    if (!comment) {
      throw new Error('Comment insert returned no rows');
    }

    const author = await this.getAuthorById(comment.authorId, tx);
    return commentAuthorForView({ row: comment, author });
  }

  async getCommentById(commentId: string): Promise<CommentView | null> {
    const [row] = await this.db
      .select()
      .from(discussionComments)
      .where(and(eq(discussionComments.commentId, commentId), isNull(discussionComments.deletedAt)))
      .limit(1);

    if (!row) return null;
    const author = await this.getAuthorById(row.authorId);
    return commentAuthorForView({ row, author });
  }

  async getCommentByIdForUpdate(commentId: string, tx: Db): Promise<CommentView | null> {
    const client = this.asDrizzle(tx);
    const rows = await client
      .select()
      .from(discussionComments)
      .where(eq(discussionComments.commentId, commentId))
      .for('update')
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    const author = await this.getAuthorById(row.authorId, tx);
    return commentAuthorForView({ row, author });
  }

  async listComments(params: ListCommentsParamsForPort): Promise<CommentWithRepliesView[]> {
    const limit = params.limit ?? 20;
    const scanCursor = params.cursor
      ? { createdAt: params.cursor.createdAt, id: params.cursor.commentId }
      : null;
    const { items: topLevel, hasNextPage } = await topLevelCommentScan(this.db, {
      quizId: params.quizId,
      limit,
      cursor: scanCursor,
    });

    // The scan helper already trims the `+1` probe row, so the result
    // is exactly `limit` items max. Re-derive the trim here defensively.
    const trimmedTopLevel = hasNextPage ? topLevel.slice(0, limit) : topLevel;
    if (trimmedTopLevel.length === 0) return [];

    const topLevelIds = trimmedTopLevel.map((c) => c.id);
    const replies = await multiReplyScan(this.db, topLevelIds, MAX_REPLIES_PER_COMMENT);

    const repliesByParent = new Map<string, CommentView[]>();
    for (const reply of replies) {
      const parentId = reply.parentCommentId;
      if (parentId === null) continue;
      if (!repliesByParent.has(parentId)) repliesByParent.set(parentId, []);
      repliesByParent.get(parentId)!.push(reply);
    }

    const userVotes = new Map<string, VoteValue>();
    if (params.viewerId) {
      const allIds = [...topLevelIds, ...replies.map((r) => r.id)];
      const voteRows = await this.db
        .select({
          commentId: discussionCommentVotes.commentId,
          value: discussionCommentVotes.value,
        })
        .from(discussionCommentVotes)
        .where(
          and(
            eq(discussionCommentVotes.userId, params.viewerId),
            inArray(discussionCommentVotes.commentId, allIds),
          ),
        );
      for (const v of voteRows) {
        userVotes.set(v.commentId, v.value);
      }
    }

    return trimmedTopLevel.map((comment) => ({
      ...comment,
      replies: repliesByParent.get(comment.id) ?? [],
      userVote: userVotes.get(comment.id) ?? null,
    }));
  }

  async listMyComments(params: ListMyCommentsParams): Promise<MyCommentView[]> {
    return paginatedCommentScan(this.db, {
      userId: params.userId,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    });
  }

  async editComment(params: import('../../domain/types').EditCommentParams): Promise<CommentView> {
    const [updated] = await this.db
      .update(discussionComments)
      .set({ body: params.body, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(discussionComments.commentId, params.commentId),
          eq(discussionComments.authorId, params.authorId),
          isNull(discussionComments.deletedAt),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Comment not found or not authorized');
    }
    const author = await this.getAuthorById(updated.authorId);
    return commentAuthorForView({ row: updated, author });
  }

  async softDeleteComment(params: { commentId: string; authorId: string }, tx?: Db): Promise<void> {
    const client = this.asDrizzle(tx);
    const now = new Date().toISOString();
    await client
      .update(discussionComments)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(discussionComments.commentId, params.commentId),
          eq(discussionComments.authorId, params.authorId),
        ),
      );
  }

  async setHiddenState(
    params: { commentId: string; hidden: boolean; moderatorId: string },
    tx?: Db,
  ): Promise<void> {
    const client = this.asDrizzle(tx);
    const now = new Date().toISOString();
    await client
      .update(discussionComments)
      .set({
        isHidden: params.hidden,
        hiddenById: params.hidden ? params.moderatorId : null,
        hiddenAt: params.hidden ? now : null,
        updatedAt: now,
      })
      .where(eq(discussionComments.commentId, params.commentId));
  }

  // ─── Counters ─────────────────────────────────────────────────────────────

  async incrementVoteCount(
    commentId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
    tx: Db,
  ): Promise<void> {
    const client = this.asDrizzle(tx);
    const totalDelta = deltaUpvotes + deltaDownvotes;
    await client
      .update(discussionComments)
      .set({
        upvotesCount: sql`${discussionComments.upvotesCount} + ${deltaUpvotes}`,
        downvotesCount: sql`${discussionComments.downvotesCount} + ${deltaDownvotes}`,
        votesCount: sql`${discussionComments.votesCount} + ${totalDelta}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionComments.commentId, commentId));
  }

  async incrementRepliesCount(commentId: string, delta: number, tx: Db): Promise<void> {
    const client = this.asDrizzle(tx);
    await client
      .update(discussionComments)
      .set({
        repliesCount: sql`${discussionComments.repliesCount} + ${delta}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionComments.commentId, commentId));
  }

  async countReplies(parentCommentId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(discussionComments)
      .where(
        and(
          eq(discussionComments.parentCommentId, parentCommentId),
          isNull(discussionComments.deletedAt),
        ),
      );
    return result?.count ?? 0;
  }

  // ─── Votes ────────────────────────────────────────────────────────────────

  async upsertVote(
    params: { userId: string; commentId: string; value: VoteValue },
    tx: Db,
  ): Promise<void> {
    const client = this.asDrizzle(tx);
    await client
      .insert(discussionCommentVotes)
      .values({
        userId: params.userId,
        commentId: params.commentId,
        value: params.value,
      })
      .onConflictDoUpdate({
        target: [discussionCommentVotes.userId, discussionCommentVotes.commentId],
        set: { value: params.value, updatedAt: new Date().toISOString() },
      });
  }

  async removeVote(params: { userId: string; commentId: string }, tx: Db): Promise<void> {
    const client = this.asDrizzle(tx);
    await client
      .delete(discussionCommentVotes)
      .where(
        and(
          eq(discussionCommentVotes.userId, params.userId),
          eq(discussionCommentVotes.commentId, params.commentId),
        ),
      );
  }

  async getUserVoteForComment(
    userId: string,
    commentId: string,
    tx?: Db,
  ): Promise<VoteValue | null> {
    const client = this.asDrizzle(tx);
    const [row] = await client
      .select({ value: discussionCommentVotes.value })
      .from(discussionCommentVotes)
      .where(
        and(
          eq(discussionCommentVotes.userId, userId),
          eq(discussionCommentVotes.commentId, commentId),
        ),
      )
      .limit(1);
    return row?.value ?? null;
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  async createReport(
    params: Parameters<CommentRepositoryPort['createReport']>[0],
  ): Promise<ReportView> {
    const [report] = await this.db
      .insert(discussionCommentReports)
      .values({
        reporterId: params.reporterId,
        commentId: params.commentId,
        reason: params.reason,
        details: params.details,
      })
      .returning();
    return report as unknown as ReportView;
  }

  async listReports(params: ListReportsParams): Promise<ReportView[]> {
    const { items, hasNextPage } = await reportScan(this.db, params);
    return hasNextPage ? items.slice(0, params.limit ?? 20) : items;
  }

  async reviewReport(params: ReviewReportParams): Promise<ReportView> {
    const [updated] = await this.db
      .update(discussionCommentReports)
      .set({
        status: params.status,
        reviewedByUserId: params.reviewerId,
        reviewedAt: new Date().toISOString(),
        actionTaken: params.actionTaken,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionCommentReports.reportId, params.reportId))
      .returning();

    if (!updated) {
      throw new Error('Report not found');
    }
    return updated as unknown as ReportView;
  }

  // ─── Counter reconciler ──────────────────────────────────────────────────

  async reconcileCounters(): Promise<{ comments: number; replies: number }> {
    const result = await this.db.transaction(async (tx) => {
      const replies = await tx.execute(sql`
        UPDATE discussion_comments AS c
        SET replies_count = counts.cnt,
            updated_at    = NOW()
        FROM (
          SELECT parent_comment_id AS comment_id, COUNT(*)::int AS cnt
          FROM discussion_comments
          WHERE deleted_at IS NULL
            AND parent_comment_id IS NOT NULL
          GROUP BY parent_comment_id
        ) AS counts
        WHERE c.comment_id = counts.comment_id
          AND c.replies_count IS DISTINCT FROM counts.cnt
        RETURNING 1
      `);

      return {
        // The comment module has no `discussion_threads.comments_count`
        // counter anymore. The aggregator is just replies_count on
        // discussion_comments. Return both keys for the schedulers
        // that still log them.
        comments: 0,
        replies: (replies.rows ?? []).length,
      };
    });

    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  async getAuthorForComment(commentId: string, tx?: Db): Promise<AuthorView | null> {
    const client = this.asDrizzle(tx);
    const [row] = await client
      .select({
        authorId: discussionComments.authorId,
      })
      .from(discussionComments)
      .where(eq(discussionComments.commentId, commentId))
      .limit(1);

    if (!row) return null;
    return this.getAuthorById(row.authorId, tx);
  }

  async getUsername(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    return row?.username ?? null;
  }

  async getUsernamesForUsers(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db
      .select({ userId: users.userId, username: users.username })
      .from(users)
      .where(inArray(users.userId, userIds));
    return new Map(rows.map((r) => [r.userId, r.username]));
  }

  async transactionally<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(this.brand(tx)));
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Resolve an author by id via the `users` + `userProfiles` join.
   * Returns a placeholder `AuthorView` (empty username) if the user
   * is missing — this is a defensive fallback and should never occur
   * because `author_id` is set by the service against a user the
   * service already verified exists.
   */
  private async getAuthorById(userId: string, tx?: Db): Promise<AuthorView> {
    const client = this.asDrizzle(tx);
    const [row] = await client
      .select({
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(users.userId, userId))
      .limit(1);

    return {
      userId,
      username: row?.username ?? '',
      displayName: row?.displayName ?? null,
      avatarUrl: row?.avatarUrl ?? null,
    };
  }

  /**
   * Cast the opaque `Db` brand to the concrete Drizzle type. The
   * column-level types are bridged by the schema file; the value
   * at runtime is always a Drizzle transaction or the root DB.
   */
  private asDrizzle(tx: Db | undefined): DrizzleDB {
    if (tx === undefined) return this.db;
    return tx as unknown as DrizzleDB;
  }

  /**
   * Wrap a Drizzle transaction in the opaque `Db` brand so the
   * caller can pass it back to repository write methods.
   */
  private brand(tx: unknown): Db {
    return tx as Db;
  }
}

// max-replies limit is exported so the historical `MAX_REPLIES_PER_COMMENT`
// re-export in the service file keeps compiling. The value lives in
// `domain/constants.ts` and is the canonical source.
export { MAX_REPLIES_PER_COMMENT } from '../../domain/constants';
