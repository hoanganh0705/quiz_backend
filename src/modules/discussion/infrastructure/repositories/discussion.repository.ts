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
  quizzes,
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
  QuizDiscussionListItem,
  MyDiscussionListItem,
  MyCommentListItem,
  MyUpvotedThreadListItem,
  MyUpvotedCommentListItem,
  TrendingDiscussionListItem,
  UnansweredDiscussionListItem,
  SearchDiscussionListItem,
  RelatedDiscussionListItem,
  ThreadParticipantListItem,
  PublicDiscussionProfile,
  ThreadStats,
  MyDiscussionStats,
} from '../../domain/types';
import { eq, and, inArray, sql, desc, asc, lte, gte, isNull, count, isNotNull } from 'drizzle-orm';
import type { DiscussionRepositoryPort } from '../../domain/ports';

export const MAX_REPLIES_PER_COMMENT = 100;

// Drizzle trả về camelCase — dùng camelCase cho tất cả row types
type DiscussionThreadRow = {
  threadId: string;
  quizId: string;
  authorId: string;
  title: string;
  body: string;
  status: 'open' | 'closed' | 'hidden' | 'deleted';
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
  status: import('../../domain/types').DiscussionContentStatus;
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

type ThreadParticipantRow = {
  userId: string;
  username: string;
  commentCount: number;
};

type MyUpvotedThreadRow = {
  threadId: string;
  title: string;
  voteCount: number;
  commentCount: number;
  createdAt: string;
  upvotedAt: string;
};

type MyUpvotedCommentRow = {
  commentId: string;
  threadId: string;
  content: string;
  voteCount: number;
  createdAt: string;
  upvotedAt: string;
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

  async listQuizDiscussions(params: {
    quizId: string;
    limit: number;
    cursor?: { createdAt: string; threadId: string } | null;
  }): Promise<QuizDiscussionListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionThreads.createdAt} < ${params.cursor.createdAt}
          OR (
            ${discussionThreads.createdAt} = ${params.cursor.createdAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,
        authorId: discussionThreads.authorId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(discussionThreads.quizId, params.quizId),
          isNull(discussionThreads.deletedAt),
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionThreads.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return rows.map((row) => ({
      threadId: row.threadId,
      quizId: row.quizId,
      title: row.title,
      author: {
        userId: row.authorId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      },
      commentCount: row.commentCount,
      voteCount: row.voteCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async listMyDiscussions(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; threadId: string } | null;
  }): Promise<MyDiscussionListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionThreads.createdAt} < ${params.cursor.createdAt}
          OR (
            ${discussionThreads.createdAt} = ${params.cursor.createdAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

    const quizRows = await this.db.select().from(quizzes);
    const quizTitleById = new Map<string, string>(
      quizRows.map((quiz) => [quiz.quizId, quiz.title] as const),
    );

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,
      })
      .from(discussionThreads)
      .where(
        and(
          eq(discussionThreads.authorId, params.userId),
          isNull(discussionThreads.deletedAt),
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionThreads.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return rows.map((row) => ({
      threadId: row.threadId,
      quizId: row.quizId,
      quizTitle: quizTitleById.get(row.quizId) ?? '',
      title: row.title,
      commentCount: row.commentCount,
      voteCount: row.voteCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async listDiscussionsByUser(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; threadId: string } | null;
  }): Promise<MyDiscussionListItem[]> {
    return this.listMyDiscussions(params);
  }

  async listMyComments(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; commentId: string } | null;
  }): Promise<MyCommentListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionComments.createdAt} < ${params.cursor.createdAt}
          OR (
            ${discussionComments.createdAt} = ${params.cursor.createdAt}
            AND ${discussionComments.commentId} < ${params.cursor.commentId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        commentId: discussionComments.commentId,
        threadId: discussionComments.threadId,
        threadTitle: discussionThreads.title,
        quizId: discussionThreads.quizId,
        content: discussionComments.body,
        repliesCount: discussionComments.repliesCount,
        votesCount: discussionComments.votesCount,
        createdAt: discussionComments.createdAt,
        updatedAt: discussionComments.updatedAt,
      })
      .from(discussionComments)
      .innerJoin(discussionThreads, eq(discussionComments.threadId, discussionThreads.threadId))
      .where(
        and(
          eq(discussionComments.authorId, params.userId),
          isNull(discussionComments.deletedAt),
          isNull(discussionThreads.deletedAt),
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionComments.createdAt), desc(discussionComments.commentId))
      .limit(params.limit + 1);

    return rows.map((row) => ({
      commentId: row.commentId,
      threadId: row.threadId,
      threadTitle: row.threadTitle,
      quizId: row.quizId,
      content: row.content,
      repliesCount: row.repliesCount,
      votesCount: row.votesCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async listMyUpvotedThreads(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MyUpvotedThreadListItem[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(discussionVotes)
      .innerJoin(discussionThreads, eq(discussionVotes.targetId, discussionThreads.threadId))
      .where(
        and(
          eq(discussionVotes.userId, params.userId),
          eq(discussionVotes.targetType, 'thread'),
          eq(discussionVotes.value, 'upvote'),
          isNull(discussionThreads.deletedAt),
          eq(discussionThreads.status, 'open'),
        ),
      );

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        title: discussionThreads.title,
        voteCount: discussionThreads.votesCount,
        commentCount: discussionThreads.commentsCount,
        createdAt: discussionThreads.createdAt,
        upvotedAt: discussionVotes.createdAt,
      })
      .from(discussionVotes)
      .innerJoin(discussionThreads, eq(discussionVotes.targetId, discussionThreads.threadId))
      .where(
        and(
          eq(discussionVotes.userId, params.userId),
          eq(discussionVotes.targetType, 'thread'),
          eq(discussionVotes.value, 'upvote'),
          isNull(discussionThreads.deletedAt),
          eq(discussionThreads.status, 'open'),
        ),
      )
      .orderBy(desc(discussionVotes.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit)
      .offset(offset);

    return {
      items: (rows as MyUpvotedThreadRow[]).map((row) => ({
        threadId: row.threadId,
        title: row.title,
        voteCount: row.voteCount,
        commentCount: row.commentCount,
        createdAt: row.createdAt,
        upvotedAt: row.upvotedAt,
      })),
      total: Number(totalRow?.count ?? 0),
    };
  }

  async listMyUpvotedComments(params: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ items: MyUpvotedCommentListItem[]; total: number }> {
    const offset = (params.page - 1) * params.limit;

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(discussionVotes)
      .innerJoin(discussionComments, eq(discussionVotes.targetId, discussionComments.commentId))
      .where(
        and(
          eq(discussionVotes.userId, params.userId),
          eq(discussionVotes.targetType, 'comment'),
          eq(discussionVotes.value, 'upvote'),
          isNull(discussionComments.deletedAt),
          eq(discussionComments.status, 'visible'),
        ),
      );

    const rows = await this.db
      .select({
        commentId: discussionComments.commentId,
        threadId: discussionComments.threadId,
        content: discussionComments.body,
        voteCount: discussionComments.votesCount,
        createdAt: discussionComments.createdAt,
        upvotedAt: discussionVotes.createdAt,
      })
      .from(discussionVotes)
      .innerJoin(discussionComments, eq(discussionVotes.targetId, discussionComments.commentId))
      .where(
        and(
          eq(discussionVotes.userId, params.userId),
          eq(discussionVotes.targetType, 'comment'),
          eq(discussionVotes.value, 'upvote'),
          isNull(discussionComments.deletedAt),
          eq(discussionComments.status, 'visible'),
        ),
      )
      .orderBy(desc(discussionVotes.createdAt), desc(discussionComments.commentId))
      .limit(params.limit)
      .offset(offset);

    return {
      items: (rows as MyUpvotedCommentRow[]).map((row) => ({
        commentId: row.commentId,
        threadId: row.threadId,
        content: row.content,
        voteCount: row.voteCount,
        createdAt: row.createdAt,
        upvotedAt: row.upvotedAt,
      })),
      total: Number(totalRow?.count ?? 0),
    };
  }

  async listCommentsByUser(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; commentId: string } | null;
  }): Promise<MyCommentListItem[]> {
    return this.listMyComments(params);
  }

  async listTrendingDiscussions(params: {
    limit: number;
    cursor?: { score: number; threadId: string } | null;
  }): Promise<TrendingDiscussionListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          (
            ${discussionThreads.votesCount} * 3 +
            ${discussionThreads.commentsCount} * 2 +
            COALESCE(
              (SELECT COUNT(*) FROM discussion_comments dc
               WHERE dc.thread_id = ${discussionThreads.threadId}
               AND dc.deleted_at IS NULL
               AND dc.created_at > NOW() - INTERVAL '7 days')::int,
              0
            )
          ) < ${params.cursor.score}
          OR (
            (
              ${discussionThreads.votesCount} * 3 +
              ${discussionThreads.commentsCount} * 2 +
              COALESCE(
                (SELECT COUNT(*) FROM discussion_comments dc
                 WHERE dc.thread_id = ${discussionThreads.threadId}
                 AND dc.deleted_at IS NULL
                 AND dc.created_at > NOW() - INTERVAL '7 days')::int,
                0
              )
            ) = ${params.cursor.score}
            AND ${discussionThreads.threadId} > ${params.cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,

        authorId: discussionThreads.authorId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,

        replyCount: sql<number>`COALESCE(
          (
            SELECT COUNT(*)
            FROM discussion_comments dc
            WHERE dc.thread_id = ${discussionThreads.threadId}
              AND dc.deleted_at IS NULL
              AND dc.parent_comment_id IS NOT NULL
          )::int,
          0
        )`,

        latestActivityAt: sql<Date>`GREATEST(
          ${discussionThreads.updatedAt},
          COALESCE(
            (
              SELECT MAX(dc.created_at)
              FROM discussion_comments dc
              WHERE dc.thread_id = ${discussionThreads.threadId}
                AND dc.deleted_at IS NULL
            ),
            ${discussionThreads.updatedAt}
          )
        )`,

        trendingScore: sql<number>`(
          ${discussionThreads.votesCount} * 3 +
          ${discussionThreads.commentsCount} * 2 +
          COALESCE(
            (
              SELECT COUNT(*)
              FROM discussion_comments dc
              WHERE dc.thread_id = ${discussionThreads.threadId}
                AND dc.deleted_at IS NULL
                AND dc.created_at > NOW() - INTERVAL '7 days'
            )::int,
            0
          )
        )::float`,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(discussionThreads.status, 'open'),
          isNull(discussionThreads.deletedAt),
          cursorCondition,
        ),
      )
      .orderBy(
        desc(sql`
          (
            ${discussionThreads.votesCount} * 3 +
            ${discussionThreads.commentsCount} * 2 +
            COALESCE(
              (
                SELECT COUNT(*)
                FROM discussion_comments dc
                WHERE dc.thread_id = ${discussionThreads.threadId}
                  AND dc.deleted_at IS NULL
                  AND dc.created_at > NOW() - INTERVAL '7 days'
              )::int,
              0
            )
          )
        `),
        desc(discussionThreads.threadId),
      )
      .limit(params.limit + 1);

    return rows.map((row) => ({
      threadId: row.threadId,
      quizId: row.quizId,
      title: row.title,
      author: {
        userId: row.authorId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      },
      commentCount: row.commentCount,
      replyCount: Number(row.replyCount),
      voteCount: row.voteCount,
      latestActivityAt:
        row.latestActivityAt instanceof Date
          ? row.latestActivityAt.toISOString()
          : row.latestActivityAt,
      createdAt: row.createdAt,
      trendingScore: Number(row.trendingScore),
    }));
  }

  async listUnansweredDiscussions(params: {
    limit: number;
    cursor?: { createdAt: string; threadId: string } | null;
  }): Promise<UnansweredDiscussionListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionThreads.createdAt} < ${params.cursor.createdAt}
          OR (
            ${discussionThreads.createdAt} = ${params.cursor.createdAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,
        authorId: discussionThreads.authorId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(discussionThreads.status, 'open'),
          eq(discussionThreads.commentsCount, 0),
          isNull(discussionThreads.deletedAt),
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionThreads.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return rows.map((row) => ({
      threadId: row.threadId,
      quizId: row.quizId,
      title: row.title,
      author: {
        userId: row.authorId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      },
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async searchDiscussions(params: {
    query: string;
    limit: number;
    cursor?: { createdAt: string; threadId: string } | null;
  }): Promise<SearchDiscussionListItem[]> {
    const searchPattern = `%${params.query}%`;
    const searchCondition = sql`(
      ${discussionThreads.title} ILIKE ${searchPattern}
      OR ${discussionThreads.body} ILIKE ${searchPattern}
    )`;

    const cursorCondition = params.cursor
      ? sql`(
          ${discussionThreads.createdAt} < ${params.cursor.createdAt}
          OR (
            ${discussionThreads.createdAt} = ${params.cursor.createdAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,
        authorId: discussionThreads.authorId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(discussionThreads.status, 'open'),
          isNull(discussionThreads.deletedAt),
          searchCondition,
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionThreads.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return rows.map((row) => ({
      threadId: row.threadId,
      quizId: row.quizId,
      title: row.title,
      author: {
        userId: row.authorId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
      },
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async findRelatedThreads(params: {
    threadId: string;
    limit: number;
  }): Promise<RelatedDiscussionListItem[]> {
    const titleTokens = sql`ARRAY(
      SELECT DISTINCT token
      FROM unnest(regexp_split_to_array(lower(${discussionThreads.title}), E'\\W+')) AS token
      WHERE length(token) >= 3
    )`;

    const baseThread = this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        titleTokens,
      })
      .from(discussionThreads)
      .where(
        and(
          eq(discussionThreads.threadId, params.threadId),
          eq(discussionThreads.status, 'open'),
          isNull(discussionThreads.deletedAt),
        ),
      )
      .as('base_thread');

    const candidateTitleTokens = sql<string[]>`ARRAY(
      SELECT DISTINCT token
      FROM unnest(regexp_split_to_array(lower(${discussionThreads.title}), E'\\W+')) AS token
      WHERE length(token) >= 3
    )`;

    const sameQuizScore = sql<number>`CASE WHEN ${discussionThreads.quizId} = ${baseThread.quizId} THEN 100 ELSE 0 END`;
    const categoryOverlapScore = sql<number>`COALESCE((
      SELECT count(DISTINCT qc_candidate.category_id)::int
      FROM quiz_categories qc_candidate
      INNER JOIN quiz_categories qc_base
        ON qc_base.category_id = qc_candidate.category_id
      WHERE qc_candidate.quiz_id = ${discussionThreads.quizId}
        AND qc_base.quiz_id = ${baseThread.quizId}
    ), 0)`;
    const tagOverlapScore = sql<number>`COALESCE((
      SELECT count(DISTINCT qt_candidate.tag_id)::int
      FROM quiz_tags qt_candidate
      INNER JOIN quiz_tags qt_base
        ON qt_base.tag_id = qt_candidate.tag_id
      WHERE qt_candidate.quiz_id = ${discussionThreads.quizId}
        AND qt_base.quiz_id = ${baseThread.quizId}
    ), 0)`;
    const titleOverlapScore = sql<number>`COALESCE((
      SELECT count(DISTINCT token)::int
      FROM unnest(${baseThread.titleTokens}) AS token
      WHERE token = ANY(${candidateTitleTokens})
    ), 0)`;
    const relevanceScore = sql<number>`(
      ${sameQuizScore}
      + (${categoryOverlapScore} * 20)
      + (${tagOverlapScore} * 15)
      + (${titleOverlapScore} * 10)
    )`;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        relevanceScore,
      })
      .from(discussionThreads)
      .innerJoin(baseThread, sql`true`)
      .where(
        and(
          eq(discussionThreads.status, 'open'),
          isNull(discussionThreads.deletedAt),
          sql`${discussionThreads.threadId} <> ${params.threadId}`,
          sql`${relevanceScore} > 0`,
        ),
      )
      .orderBy(
        desc(relevanceScore),
        desc(discussionThreads.commentsCount),
        desc(discussionThreads.votesCount),
      )
      .limit(params.limit);

    return rows.map((row) => ({
      threadId: row.threadId,
      title: row.title,
      commentCount: row.commentCount,
      voteCount: row.voteCount,
      relevanceScore: Number(row.relevanceScore),
    }));
  }

  async listThreadParticipants(threadId: string): Promise<ThreadParticipantListItem[]> {
    const participantRows = (await this.db.execute(sql`
      WITH participant_counts AS (
        SELECT
          participant.user_id AS user_id,
          SUM(participant.comment_count)::int AS comment_count
        FROM (
          SELECT
            ${discussionThreads.authorId} AS user_id,
            0::int AS comment_count
          FROM ${discussionThreads}
          WHERE ${discussionThreads.threadId} = ${threadId}
            AND ${discussionThreads.deletedAt} IS NULL

          UNION ALL

          SELECT
            ${discussionComments.authorId} AS user_id,
            COUNT(*)::int AS comment_count
          FROM ${discussionComments}
          WHERE ${discussionComments.threadId} = ${threadId}
            AND ${discussionComments.deletedAt} IS NULL
          GROUP BY ${discussionComments.authorId}
        ) participant
        GROUP BY participant.user_id
      )
      SELECT
        ${users.userId} AS "userId",
        ${users.username} AS username,
        participant_counts.comment_count AS "commentCount"
      FROM participant_counts
      INNER JOIN ${users}
        ON ${users.userId} = participant_counts.user_id
      ORDER BY participant_counts.comment_count DESC, ${users.username} ASC
    `)) as { rows: ThreadParticipantRow[] };

    return participantRows.rows.map((row) => ({
      userId: row.userId,
      username: row.username,
      commentCount: row.commentCount,
    }));
  }

  async getThreadStats(threadId: string): Promise<ThreadStats | null> {
    const [thread] = await this.db
      .select()
      .from(discussionThreads)
      .where(and(eq(discussionThreads.threadId, threadId), isNull(discussionThreads.deletedAt)));

    if (!thread) return null;

    const [stats] = await this.db
      .select({
        totalReplies: sql<number>`COALESCE(SUM(${discussionComments.repliesCount}), 0)::int`,
        upvotes: discussionThreads.upvotesCount,
        downvotes: discussionThreads.downvotesCount,
        latestActivityAt: sql<string>`GREATEST(
          ${discussionThreads.updatedAt},
          COALESCE(
            (SELECT MAX(dc.created_at) FROM discussion_comments dc
             WHERE dc.thread_id = ${discussionThreads.threadId}
             AND dc.deleted_at IS NULL)::text,
            ${discussionThreads.updatedAt}
          )
        )`,
      })
      .from(discussionThreads)
      .leftJoin(discussionComments, eq(discussionComments.threadId, discussionThreads.threadId))
      .where(eq(discussionThreads.threadId, threadId))
      .groupBy(
        discussionThreads.threadId,
        discussionThreads.upvotesCount,
        discussionThreads.downvotesCount,
        discussionThreads.updatedAt,
      );

    const [participantCount] = await this.db
      .select({ count: count() })
      .from(discussionComments)
      .where(
        and(
          eq(discussionComments.threadId, threadId),
          isNull(discussionComments.deletedAt),
          isNotNull(discussionComments.authorId),
        ),
      );

    return {
      threadId,
      totalComments: thread.commentsCount,
      totalReplies: stats ? Number(stats.totalReplies) : 0,
      totalParticipants: participantCount ? Number(participantCount.count) : 0,
      upvotes: thread.upvotesCount,
      downvotes: thread.downvotesCount,
      latestActivityAt: stats?.latestActivityAt ?? thread.updatedAt,
    };
  }

  async getPublicDiscussionProfile(userId: string): Promise<PublicDiscussionProfile> {
    const [threadStats] = await this.db
      .select({
        threadsCreated: count(discussionThreads.threadId),
        threadUpvotesReceived: sql<number>`COALESCE(SUM(${discussionThreads.upvotesCount}), 0)::int`,
      })
      .from(discussionThreads)
      .where(and(eq(discussionThreads.authorId, userId), isNull(discussionThreads.deletedAt)));

    const [commentStats] = await this.db
      .select({
        commentsCreated: count(discussionComments.commentId),
        commentUpvotesReceived: sql<number>`COALESCE(SUM(${discussionComments.upvotesCount}), 0)::int`,
        acceptedAnswers: sql<number>`COALESCE(SUM(CASE WHEN ${discussionComments.status} = 'accepted' THEN 1 ELSE 0 END), 0)::int`,
      })
      .from(discussionComments)
      .where(and(eq(discussionComments.authorId, userId), isNull(discussionComments.deletedAt)));

    const threadsCreated = Number(threadStats?.threadsCreated ?? 0);
    const commentsCreated = Number(commentStats?.commentsCreated ?? 0);
    const acceptedAnswers = Number(commentStats?.acceptedAnswers ?? 0);
    const threadUpvotesReceived = Number(threadStats?.threadUpvotesReceived ?? 0);
    const commentUpvotesReceived = Number(commentStats?.commentUpvotesReceived ?? 0);

    return {
      threadsCreated,
      commentsCreated,
      acceptedAnswers,
      reputation: threadUpvotesReceived * 10 + commentUpvotesReceived * 5 + acceptedAnswers * 20,
    };
  }

  async getMyDiscussionStats(userId: string): Promise<MyDiscussionStats> {
    const [threadStats] = await this.db
      .select({
        totalThreadsCreated: count(discussionThreads.threadId),
        totalReceivedVotes: sql<number>`COALESCE(SUM(${discussionThreads.votesCount})::int, 0)`,
        latestThreadActivity: sql<string | null>`MAX(${discussionThreads.updatedAt})`,
      })
      .from(discussionThreads)
      .where(and(eq(discussionThreads.authorId, userId), isNull(discussionThreads.deletedAt)));

    const [commentStats] = await this.db
      .select({
        totalCommentsCreated: count(discussionComments.commentId),
        totalRepliesCreated: sql<number>`COALESCE(SUM(${discussionComments.repliesCount})::int, 0)`,
        latestCommentActivity: sql<string | null>`MAX(${discussionComments.updatedAt})`,
      })
      .from(discussionComments)
      .where(and(eq(discussionComments.authorId, userId), isNull(discussionComments.deletedAt)));

    const latestThread = threadStats?.latestThreadActivity;
    const latestComment = commentStats?.latestCommentActivity;
    const latestDiscussionActivityAt =
      !latestThread && !latestComment
        ? null
        : !latestThread
          ? latestComment
          : !latestComment
            ? latestThread
            : latestThread > latestComment
              ? latestThread
              : latestComment;

    return {
      totalThreadsCreated: threadStats ? Number(threadStats.totalThreadsCreated) : 0,
      totalCommentsCreated: commentStats ? Number(commentStats.totalCommentsCreated) : 0,
      totalRepliesCreated: commentStats ? Number(commentStats.totalRepliesCreated) : 0,
      totalDiscussionContributions:
        (threadStats ? Number(threadStats.totalThreadsCreated) : 0) +
        (commentStats ? Number(commentStats.totalCommentsCreated) : 0),
      totalReceivedVotes: threadStats ? Number(threadStats.totalReceivedVotes) : 0,
      latestDiscussionActivityAt,
    };
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
    const conditions: ReturnType<typeof eq>[] = [];

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
