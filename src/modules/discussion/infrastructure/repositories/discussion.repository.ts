import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  discussionThreads,
  discussionComments,
  discussionVotes,
  discussionReports,
  users,
  userProfiles,
} from '@/core/database/schema';
import type {
  DiscussionThread,
  DiscussionThreadDetail,
  DiscussionComment,
  DiscussionCommentWithReplies,
  DiscussionVote,
  DiscussionReport,
  ListThreadsParams,
  ListCommentsParams,
  CreateThreadParams,
  UpdateThreadParams,
  CreateCommentParams,
  UpdateCommentParams,
  VoteParams,
  ReportParams,
  ReviewReportParams,
  DiscussionVoteValue,
} from '../../domain/types';
import { eq, and, inArray, sql, desc, asc, lte, gte, isNull } from 'drizzle-orm';
import type { DiscussionRepositoryPort } from '../../domain/ports';

export const MAX_REPLIES_PER_COMMENT = 100;

// Drizzle trả về camelCase — dùng camelCase cho tất cả row types
type DiscussionThreadRow = {
  threadId: string;
  quizId: string;
  authorId: string;
  title: string;
  body: string;
  status: any;
  commentsCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type DiscussionCommentRow = {
  commentId: string;
  threadId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  status: any;
  repliesCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type AuthorInfo = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class DiscussionRepository implements DiscussionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ─── THREADS ────────────────────────────────────────────────────────────────

  async createThread(params: CreateThreadParams): Promise<DiscussionThread> {
    const [thread] = await this.db
      .insert(discussionThreads)
      .values({
        quizId: params.quizId,
        authorId: params.authorId,
        title: params.title,
        body: params.body,
        status: 'open',
      })
      .returning();

    return this.enrichThread(thread as unknown as DiscussionThreadRow);
  }

  async getThreadById(threadId: string): Promise<DiscussionThread | null> {
    const [thread] = await this.db
      .select()
      .from(discussionThreads)
      .where(and(eq(discussionThreads.threadId, threadId), isNull(discussionThreads.deletedAt)));

    if (!thread) return null;
    return this.enrichThread(thread as unknown as DiscussionThreadRow);
  }

  async getThreadDetail(
    threadId: string,
    userId?: string | null,
  ): Promise<DiscussionThreadDetail | null> {
    const [thread] = await this.db
      .select()
      .from(discussionThreads)
      .where(and(eq(discussionThreads.threadId, threadId), isNull(discussionThreads.deletedAt)));

    if (!thread) return null;

    const enriched = await this.enrichThread(thread as unknown as DiscussionThreadRow);

    let userVote: DiscussionVoteValue | null = null;
    if (userId) {
      userVote = await this.getUserVote(userId, 'thread', threadId);
    }

    // Lấy top-level comments kèm author info trong một query
    const topLevelComments = await this.db
      .select({
        comment: discussionComments,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(discussionComments.threadId, threadId),
          isNull(discussionComments.parentCommentId),
          isNull(discussionComments.deletedAt),
        ),
      )
      .orderBy(asc(discussionComments.createdAt));

    const topLevelCommentIds = topLevelComments.map((row) => row.comment.commentId);

    // Batch-fetch tất cả replies trong một query — tránh N round-trips
    const allReplies: DiscussionComment[] = topLevelCommentIds.length
      ? await this.getRepliesByParentIds(topLevelCommentIds, MAX_REPLIES_PER_COMMENT)
      : [];

    const repliesByParent = new Map<string, DiscussionComment[]>();
    for (const reply of allReplies) {
      const parentId = reply.parentCommentId!;
      if (!repliesByParent.has(parentId)) repliesByParent.set(parentId, []);
      repliesByParent.get(parentId)!.push(reply);
    }

    const commentsWithReplies: DiscussionCommentWithReplies[] = topLevelComments.map((row) => {
      const comment = row.comment as unknown as DiscussionCommentRow;
      const enrichedComment = this.enrichComment(comment, {
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarUrl: row.authorAvatarUrl,
      });
      return {
        ...enrichedComment,
        replies: repliesByParent.get(row.comment.commentId) ?? [],
        userVote: null,
      };
    });

    return { ...enriched, userVote, comments: commentsWithReplies };
  }

  async listThreads(params: ListThreadsParams): Promise<DiscussionThread[]> {
    const {
      quizId,
      authorId,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc',
      limit = 20,
      cursor,
    } = params;

    const conditions = [isNull(discussionThreads.deletedAt)];

    if (quizId) conditions.push(eq(discussionThreads.quizId, quizId));
    if (authorId) conditions.push(eq(discussionThreads.authorId, authorId));
    if (status) conditions.push(eq(discussionThreads.status, status));

    const orderCol =
      sortBy === 'votes_count'
        ? discussionThreads.votesCount
        : sortBy === 'comments_count'
          ? discussionThreads.commentsCount
          : discussionThreads.createdAt;

    const orderDir = sortOrder === 'asc' ? asc : desc;

    const cursorCondition = cursor
      ? sortOrder === 'asc'
        ? gte(orderCol, cursor)
        : lte(orderCol, cursor)
      : undefined;

    if (cursorCondition) conditions.push(cursorCondition);

    const rows = await this.db
      .select({
        thread: discussionThreads,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(...conditions))
      .orderBy(orderDir(orderCol))
      .limit(limit + 1);

    return Promise.all(
      rows.map((row) =>
        this.enrichThread(row.thread as unknown as DiscussionThreadRow, {
          username: row.authorUsername,
          displayName: row.authorDisplayName,
          avatarUrl: row.authorAvatarUrl,
        }),
      ),
    );
  }

  async updateThread(params: UpdateThreadParams): Promise<DiscussionThread> {
    const setValues: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (params.title !== undefined) setValues.title = params.title;
    if (params.body !== undefined) setValues.body = params.body;

    const [updated] = await this.db
      .update(discussionThreads)
      .set(setValues)
      .where(
        and(
          eq(discussionThreads.threadId, params.threadId),
          eq(discussionThreads.authorId, params.authorId),
          isNull(discussionThreads.deletedAt),
        ),
      )
      .returning();

    if (!updated) throw new Error('Thread not found or not authorized');
    return this.enrichThread(updated as unknown as DiscussionThreadRow);
  }

  async softDeleteThread(params: { threadId: string; authorId: string }): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(discussionThreads)
      .set({ deletedAt: now, updatedAt: now, status: 'deleted' })
      .where(
        and(
          eq(discussionThreads.threadId, params.threadId),
          eq(discussionThreads.authorId, params.authorId),
        ),
      );
  }

  async updateThreadStatus(params: {
    threadId: string;
    status: 'open' | 'closed' | 'hidden' | 'deleted';
  }): Promise<void> {
    await this.db
      .update(discussionThreads)
      .set({ status: params.status, updatedAt: new Date().toISOString() })
      .where(eq(discussionThreads.threadId, params.threadId));
  }

  async incrementThreadCommentCount(threadId: string, delta: number): Promise<void> {
    await this.db
      .update(discussionThreads)
      .set({
        commentsCount: sql`${discussionThreads.commentsCount} + ${delta}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionThreads.threadId, threadId));
  }

  async updateThreadVotes(
    threadId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
  ): Promise<void> {
    // Tính tổng delta trước trong JS để tránh lỗi SQL với nhiều tham số liên tiếp
    const totalDelta = deltaUpvotes + deltaDownvotes;
    await this.db
      .update(discussionThreads)
      .set({
        upvotesCount: sql`${discussionThreads.upvotesCount} + ${deltaUpvotes}`,
        downvotesCount: sql`${discussionThreads.downvotesCount} + ${deltaDownvotes}`,
        votesCount: sql`${discussionThreads.votesCount} + ${totalDelta}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionThreads.threadId, threadId));
  }

  // ─── COMMENTS ───────────────────────────────────────────────────────────────

  async createComment(params: CreateCommentParams): Promise<DiscussionComment> {
    const [comment] = await this.db
      .insert(discussionComments)
      .values({
        threadId: params.threadId,
        authorId: params.authorId,
        parentCommentId: params.parentCommentId ?? null,
        body: params.body,
        status: 'visible',
      })
      .returning();

    return this.enrichComment(comment as unknown as DiscussionCommentRow);
  }

  async getCommentById(commentId: string): Promise<DiscussionComment | null> {
    const [row] = await this.db
      .select({
        comment: discussionComments,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(eq(discussionComments.commentId, commentId), isNull(discussionComments.deletedAt)),
      );

    if (!row) return null;
    return this.enrichComment(row.comment as unknown as DiscussionCommentRow, {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
    });
  }

  async listComments(params: ListCommentsParams): Promise<DiscussionCommentWithReplies[]> {
    const { threadId, parentCommentId, limit = 20, cursor } = params;

    const conditions = [
      eq(discussionComments.threadId, threadId),
      isNull(discussionComments.deletedAt),
    ];

    // Hỗ trợ lọc theo parentCommentId: null = top-level, string = replies của comment cụ thể
    if (parentCommentId === null || parentCommentId === undefined) {
      conditions.push(isNull(discussionComments.parentCommentId));
    } else {
      conditions.push(eq(discussionComments.parentCommentId, parentCommentId));
    }

    if (cursor) conditions.push(gte(discussionComments.createdAt, cursor));

    const rows = await this.db
      .select({
        comment: discussionComments,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(...conditions))
      .orderBy(asc(discussionComments.createdAt))
      .limit(limit + 1);

    const parentIds = rows.map((row) => row.comment.commentId);
    const replies: DiscussionComment[] = parentIds.length
      ? await this.getRepliesByParentIds(parentIds, MAX_REPLIES_PER_COMMENT)
      : [];

    const repliesByParent = new Map<string, DiscussionComment[]>();
    for (const reply of replies) {
      const pid = reply.parentCommentId!;
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
      repliesByParent.get(pid)!.push(reply);
    }

    return rows.map((row) => ({
      ...this.enrichComment(row.comment as unknown as DiscussionCommentRow, {
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarUrl: row.authorAvatarUrl,
      }),
      replies: repliesByParent.get(row.comment.commentId) ?? [],
      userVote: null,
    }));
  }

  async getRepliesByParentIds(
    parentIds: string[],
    limitPerParent: number,
  ): Promise<DiscussionComment[]> {
    if (parentIds.length === 0) return [];

    const rows = await this.db
      .select({
        comment: discussionComments,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          inArray(discussionComments.parentCommentId, parentIds),
          isNull(discussionComments.deletedAt),
        ),
      )
      .orderBy(asc(discussionComments.createdAt));

    // Giới hạn số reply mỗi parent ngay tại application layer
    const result: DiscussionComment[] = [];
    const countByParent = new Map<string, number>();

    for (const row of rows) {
      const parentId = row.comment.parentCommentId!;
      const count = countByParent.get(parentId) ?? 0;
      if (count < limitPerParent) {
        result.push(
          this.enrichComment(row.comment as unknown as DiscussionCommentRow, {
            username: row.authorUsername,
            displayName: row.authorDisplayName,
            avatarUrl: row.authorAvatarUrl,
          }),
        );
        countByParent.set(parentId, count + 1);
      }
    }

    return result;
  }

  async getCommentReplies(parentCommentId: string, limit: number): Promise<DiscussionComment[]> {
    const rows = await this.db
      .select({
        comment: discussionComments,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(discussionComments.parentCommentId, parentCommentId),
          isNull(discussionComments.deletedAt),
        ),
      )
      .orderBy(asc(discussionComments.createdAt))
      .limit(limit);

    return rows.map((row) =>
      this.enrichComment(row.comment as unknown as DiscussionCommentRow, {
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarUrl: row.authorAvatarUrl,
      }),
    );
  }

  async updateComment(params: UpdateCommentParams): Promise<DiscussionComment> {
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

    if (!updated) throw new Error('Comment not found or not authorized');
    return this.enrichComment(updated as unknown as DiscussionCommentRow);
  }

  async softDeleteComment(params: { commentId: string; authorId: string }): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(discussionComments)
      .set({ deletedAt: now, updatedAt: now, status: 'deleted' })
      .where(
        and(
          eq(discussionComments.commentId, params.commentId),
          eq(discussionComments.authorId, params.authorId),
        ),
      );
  }

  async updateCommentStatus(params: {
    commentId: string;
    status: 'visible' | 'hidden' | 'deleted';
  }): Promise<void> {
    await this.db
      .update(discussionComments)
      .set({ status: params.status, updatedAt: new Date().toISOString() })
      .where(eq(discussionComments.commentId, params.commentId));
  }

  async softDeleteCommentsByThread(threadId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(discussionComments)
      .set({ deletedAt: now, updatedAt: now, status: 'deleted' })
      .where(and(eq(discussionComments.threadId, threadId), isNull(discussionComments.deletedAt)));
  }

  async incrementCommentRepliesCount(commentId: string, delta: number): Promise<void> {
    await this.db
      .update(discussionComments)
      .set({
        repliesCount: sql`${discussionComments.repliesCount} + ${delta}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionComments.commentId, commentId));
  }

  async updateCommentVotes(
    commentId: string,
    deltaUpvotes: number,
    deltaDownvotes: number,
  ): Promise<void> {
    const totalDelta = deltaUpvotes + deltaDownvotes;
    await this.db
      .update(discussionComments)
      .set({
        upvotesCount: sql`${discussionComments.upvotesCount} + ${deltaUpvotes}`,
        downvotesCount: sql`${discussionComments.downvotesCount} + ${deltaDownvotes}`,
        votesCount: sql`${discussionComments.votesCount} + ${totalDelta}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionComments.commentId, commentId));
  }

  // ─── VOTES ──────────────────────────────────────────────────────────────────

  async upsertVote(params: VoteParams): Promise<DiscussionVote> {
    const [vote] = await this.db
      .insert(discussionVotes)
      .values({
        userId: params.userId,
        targetType: params.targetType,
        targetId: params.targetId,
        value: params.value,
      })
      .onConflictDoUpdate({
        target: [discussionVotes.userId, discussionVotes.targetType, discussionVotes.targetId],
        set: {
          value: params.value,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return vote as DiscussionVote;
  }

  async removeVote(params: {
    userId: string;
    targetType: 'thread' | 'comment' | 'reply';
    targetId: string;
  }): Promise<void> {
    await this.db
      .delete(discussionVotes)
      .where(
        and(
          eq(discussionVotes.userId, params.userId),
          eq(discussionVotes.targetType, params.targetType),
          eq(discussionVotes.targetId, params.targetId),
        ),
      );
  }

  async getUserVote(
    userId: string,
    targetType: 'thread' | 'comment' | 'reply',
    targetId: string,
  ): Promise<DiscussionVoteValue | null> {
    const [vote] = await this.db
      .select({ value: discussionVotes.value })
      .from(discussionVotes)
      .where(
        and(
          eq(discussionVotes.userId, userId),
          eq(discussionVotes.targetType, targetType),
          eq(discussionVotes.targetId, targetId),
        ),
      );

    return (vote?.value as DiscussionVoteValue) ?? null;
  }

  // ─── REPORTS ────────────────────────────────────────────────────────────────

  async createReport(params: ReportParams): Promise<DiscussionReport> {
    const [report] = await this.db
      .insert(discussionReports)
      .values({
        reporterId: params.reporterId,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        details: params.details ?? null,
        status: 'open',
        actionTaken: false,
      })
      .returning();

    return report as DiscussionReport;
  }

  async getReportById(reportId: string): Promise<DiscussionReport | null> {
    const [report] = await this.db
      .select()
      .from(discussionReports)
      .where(eq(discussionReports.reportId, reportId));

    return (report as DiscussionReport) ?? null;
  }

  async listReports(params: {
    status?: 'open' | 'reviewed' | 'dismissed' | 'actioned';
    limit?: number;
    cursor?: string | null;
  }): Promise<DiscussionReport[]> {
    const { status, limit = 20, cursor } = params;
    const conditions: any[] = [];

    if (status) conditions.push(eq(discussionReports.status, status));
    if (cursor) conditions.push(lte(discussionReports.createdAt, cursor));

    const rows = await this.db
      .select()
      .from(discussionReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(discussionReports.createdAt))
      .limit(limit + 1);

    return rows as DiscussionReport[];
  }

  async reviewReport(params: ReviewReportParams): Promise<DiscussionReport> {
    const [updated] = await this.db
      .update(discussionReports)
      .set({
        status: params.status,
        reviewedByUserId: params.reviewerId,
        reviewedAt: new Date().toISOString(),
        actionTaken: params.actionTaken ?? false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discussionReports.reportId, params.reportId))
      .returning();

    if (!updated) throw new Error('Report not found');
    return updated as DiscussionReport;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private async enrichThread(
    thread: DiscussionThreadRow,
    overrideAuthor?: AuthorInfo,
  ): Promise<DiscussionThread> {
    let author: AuthorInfo;

    if (overrideAuthor) {
      author = overrideAuthor;
    } else {
      const [userRow] = await this.db
        .select({
          username: users.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(eq(users.userId, thread.authorId));

      author = {
        username: userRow?.username ?? '',
        displayName: userRow?.displayName ?? null,
        avatarUrl: userRow?.avatarUrl ?? null,
      };
    }

    return {
      threadId: thread.threadId,
      quizId: thread.quizId,
      authorId: thread.authorId,
      author: { userId: thread.authorId, ...author },
      title: thread.title,
      body: thread.body,
      status: thread.status,
      commentsCount: thread.commentsCount,
      votesCount: thread.votesCount,
      upvotesCount: thread.upvotesCount,
      downvotesCount: thread.downvotesCount,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      deletedAt: thread.deletedAt,
    };
  }

  private enrichComment(comment: DiscussionCommentRow, author?: AuthorInfo): DiscussionComment {
    return {
      commentId: comment.commentId,
      threadId: comment.threadId,
      authorId: comment.authorId,
      author: {
        userId: comment.authorId,
        username: author?.username ?? '',
        displayName: author?.displayName ?? null,
        avatarUrl: author?.avatarUrl ?? null,
      },
      parentCommentId: comment.parentCommentId,
      body: comment.body,
      status: comment.status,
      repliesCount: comment.repliesCount,
      votesCount: comment.votesCount,
      upvotesCount: comment.upvotesCount,
      downvotesCount: comment.downvotesCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
    };
  }
}
