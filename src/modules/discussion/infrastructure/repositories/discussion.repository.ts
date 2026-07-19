import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  discussionThreads,
  discussionComments,
  discussionVotes,
  discussionReports,
  users,
  userProfiles,
  quizzes,
  discussionThreadSubscriptions,
  discussionSavedThreads,
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
  MyDiscussionSubscriptionListItem,
  MySavedThreadListItem,
  TrendingDiscussionListItem,
  UnansweredDiscussionListItem,
  SearchDiscussionListItem,
  RelatedDiscussionListItem,
  ThreadParticipantListItem,
  PublicDiscussionProfile,
  ThreadStats,
  MyDiscussionStats,
  MarkThreadAsSolvedParams,
  UnsolveThreadParams,
} from '../../domain/types';
import { eq, and, inArray, sql, desc, asc, lte, gte, isNull, count, isNotNull } from 'drizzle-orm';
import type { DiscussionRepositoryPort, TransactionClient } from '../../domain/ports';

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
  isSolved: boolean;
  solvedAt: string | null;
  solvedCommentId: string | null;
  solvedBy: string | null;
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

type MyDiscussionSubscriptionRow = {
  threadId: string;
  title: string;
  commentCount: number;
  voteCount: number;
  subscribedAt: string;
};

type MySavedThreadRow = {
  threadId: string;
  title: string;
  commentCount: number;
  voteCount: number;
  savedAt: string;
};

@Injectable()
export class DiscussionRepository implements DiscussionRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
  ) {}

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

    // Pre-load the author with a JOIN so `enrichThread` does not
    // need to issue a second query. This keeps the per-thread
    // cost at exactly one roundtrip — see the `enrichThread` note
    // about why the fallback path was removed.
    return this.loadThreadWithAuthor(thread.threadId);
  }

  async getThreadById(threadId: string): Promise<DiscussionThread | null> {
    const [row] = await this.db
      .select({
        thread: discussionThreads,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(eq(discussionThreads.threadId, threadId), isNull(discussionThreads.deletedAt)));

    if (!row) return null;
    return this.enrichThread(row.thread as unknown as DiscussionThreadRow, {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
    });
  }

  async getThreadDetail(
    threadId: string,
    userId?: string | null,
  ): Promise<DiscussionThreadDetail | null> {
    const [row] = await this.db
      .select({
        thread: discussionThreads,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(eq(discussionThreads.threadId, threadId), isNull(discussionThreads.deletedAt)));

    if (!row) return null;

    let userVote: DiscussionVoteValue | null = null;
    if (userId) {
      userVote = await this.getUserVote(userId, 'thread', threadId);
    }

    const enriched = this.buildThreadFromRow(row.thread, {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
    });

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

    const topLevelCommentIds = topLevelComments.map((r) => r.comment.commentId);

    const allReplies: DiscussionComment[] = topLevelCommentIds.length
      ? await this.getRepliesByParentIds(topLevelCommentIds, MAX_REPLIES_PER_COMMENT)
      : [];

    const repliesByParent = new Map<string, DiscussionComment[]>();
    for (const reply of allReplies) {
      const parentId = reply.parentCommentId!;
      if (!repliesByParent.has(parentId)) repliesByParent.set(parentId, []);
      repliesByParent.get(parentId)!.push(reply);
    }

    const commentsWithReplies: DiscussionCommentWithReplies[] = topLevelComments.map((r) => {
      const comment = r.comment as unknown as DiscussionCommentRow;
      const enrichedComment = this.enrichComment(comment, {
        username: r.authorUsername,
        displayName: r.authorDisplayName,
        avatarUrl: r.authorAvatarUrl,
      });
      return {
        ...enrichedComment,
        replies: repliesByParent.get(r.comment.commentId) ?? [],
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

    return rows.map((row) =>
      this.enrichThread(row.thread as unknown as DiscussionThreadRow, {
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarUrl: row.authorAvatarUrl,
      }),
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

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        quizId: discussionThreads.quizId,
        quizTitle: quizzes.title,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,
      })
      .from(discussionThreads)
      .innerJoin(quizzes, eq(discussionThreads.quizId, quizzes.quizId))
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
      quizTitle: row.quizTitle,
      title: row.title,
      commentCount: row.commentCount,
      voteCount: row.voteCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
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
          eq(discussionComments.status, 'visible'),
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
    limit: number;
    cursor: { upvotedAt: string; threadId: string } | null;
  }): Promise<MyUpvotedThreadListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionVotes.createdAt} < ${params.cursor.upvotedAt}
          OR (
            ${discussionVotes.createdAt} = ${params.cursor.upvotedAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

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
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionVotes.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return (rows as MyUpvotedThreadRow[]).map((row) => ({
      threadId: row.threadId,
      title: row.title,
      voteCount: row.voteCount,
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      upvotedAt: row.upvotedAt,
    }));
  }

  async listMyUpvotedComments(params: {
    userId: string;
    limit: number;
    cursor: { upvotedAt: string; commentId: string } | null;
  }): Promise<MyUpvotedCommentListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionVotes.createdAt} < ${params.cursor.upvotedAt}
          OR (
            ${discussionVotes.createdAt} = ${params.cursor.upvotedAt}
            AND ${discussionComments.commentId} < ${params.cursor.commentId}
          )
        )`
      : undefined;

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
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionVotes.createdAt), desc(discussionComments.commentId))
      .limit(params.limit + 1);

    return (rows as MyUpvotedCommentRow[]).map((row) => ({
      commentId: row.commentId,
      threadId: row.threadId,
      content: row.content,
      voteCount: row.voteCount,
      createdAt: row.createdAt,
      upvotedAt: row.upvotedAt,
    }));
  }

  async listMyDiscussionSubscriptions(params: {
    userId: string;
    limit: number;
    cursor: { subscribedAt: string; threadId: string } | null;
  }): Promise<MyDiscussionSubscriptionListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionThreadSubscriptions.createdAt} < ${params.cursor.subscribedAt}
          OR (
            ${discussionThreadSubscriptions.createdAt} = ${params.cursor.subscribedAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        subscribedAt: discussionThreadSubscriptions.createdAt,
      })
      .from(discussionThreadSubscriptions)
      .innerJoin(
        discussionThreads,
        eq(discussionThreadSubscriptions.threadId, discussionThreads.threadId),
      )
      .where(
        and(
          eq(discussionThreadSubscriptions.userId, params.userId),
          isNull(discussionThreads.deletedAt),
          eq(discussionThreads.status, 'open'),
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionThreadSubscriptions.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return (rows as MyDiscussionSubscriptionRow[]).map((row) => ({
      threadId: row.threadId,
      title: row.title,
      commentCount: row.commentCount,
      voteCount: row.voteCount,
      subscribedAt: row.subscribedAt,
    }));
  }

  async listMySavedThreads(params: {
    userId: string;
    limit: number;
    cursor: { savedAt: string; threadId: string } | null;
  }): Promise<MySavedThreadListItem[]> {
    const cursorCondition = params.cursor
      ? sql`(
          ${discussionSavedThreads.createdAt} < ${params.cursor.savedAt}
          OR (
            ${discussionSavedThreads.createdAt} = ${params.cursor.savedAt}
            AND ${discussionThreads.threadId} < ${params.cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .select({
        threadId: discussionThreads.threadId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        savedAt: discussionSavedThreads.createdAt,
      })
      .from(discussionSavedThreads)
      .innerJoin(discussionThreads, eq(discussionSavedThreads.threadId, discussionThreads.threadId))
      .where(
        and(
          eq(discussionSavedThreads.userId, params.userId),
          isNull(discussionThreads.deletedAt),
          eq(discussionThreads.status, 'open'),
          cursorCondition,
        ),
      )
      .orderBy(desc(discussionSavedThreads.createdAt), desc(discussionThreads.threadId))
      .limit(params.limit + 1);

    return (rows as MySavedThreadRow[]).map((row) => ({
      threadId: row.threadId,
      title: row.title,
      commentCount: row.commentCount,
      voteCount: row.voteCount,
      savedAt: row.savedAt,
    }));
  }

  async subscribeToThread(params: { userId: string; threadId: string }): Promise<void> {
    await this.db
      .insert(discussionThreadSubscriptions)
      .values({
        userId: params.userId,
        threadId: params.threadId,
      })
      .onConflictDoNothing();
  }

  async unsubscribeFromThread(params: { userId: string; threadId: string }): Promise<void> {
    await this.db
      .delete(discussionThreadSubscriptions)
      .where(
        and(
          eq(discussionThreadSubscriptions.userId, params.userId),
          eq(discussionThreadSubscriptions.threadId, params.threadId),
        ),
      );
  }

  async saveThread(params: { userId: string; threadId: string }): Promise<void> {
    await this.db
      .insert(discussionSavedThreads)
      .values({
        userId: params.userId,
        threadId: params.threadId,
      })
      .onConflictDoNothing();
  }

  async unsaveThread(params: { userId: string; threadId: string }): Promise<void> {
    await this.db
      .delete(discussionSavedThreads)
      .where(
        and(
          eq(discussionSavedThreads.userId, params.userId),
          eq(discussionSavedThreads.threadId, params.threadId),
        ),
      );
  }

  async markThreadAsSolved(params: MarkThreadAsSolvedParams): Promise<DiscussionThread> {
    const now = new Date().toISOString();

    const [updated] = await this.db
      .update(discussionThreads)
      .set({
        isSolved: true,
        solvedAt: now,
        solvedCommentId: params.commentId,
        solvedBy: params.actorId,
        updatedAt: now,
      })
      .where(eq(discussionThreads.threadId, params.threadId))
      .returning({ threadId: discussionThreads.threadId });

    if (!updated) {
      throw new Error('Thread not found');
    }

    // Re-read the thread with the author JOIN'd in a single query
    // instead of falling back to the per-thread author fetch in
    // `enrichThread`. Avoids the N+1 trap in any future caller.
    return this.loadThreadWithAuthor(updated.threadId);
  }

  async unsolveThread(params: UnsolveThreadParams): Promise<DiscussionThread> {
    const now = new Date().toISOString();

    const [updated] = await this.db
      .update(discussionThreads)
      .set({
        isSolved: false,
        solvedAt: null,
        solvedCommentId: null,
        solvedBy: null,
        updatedAt: now,
      })
      .where(eq(discussionThreads.threadId, params.threadId))
      .returning({ threadId: discussionThreads.threadId });

    if (!updated) {
      throw new Error('Thread not found');
    }

    return this.loadThreadWithAuthor(updated.threadId);
  }

  private static readonly TRENDING_CACHE_TTL_MS = 60_000; // 60 seconds
  private static readonly TRENDING_CACHE_KEY = 'discussion:trending:page1';

  async listTrendingDiscussions(params: {
    limit: number;
    cursor?: { score: number; createdAt: string; threadId: string } | null;
  }): Promise<TrendingDiscussionListItem[]> {
    // Cache only the first page (no cursor) for 60s to avoid repeated expensive queries
    if (!params.cursor) {
      return this.cache.getOrSet<TrendingDiscussionListItem[]>(
        DiscussionRepository.TRENDING_CACHE_KEY,
        DiscussionRepository.TRENDING_CACHE_TTL_MS,
        () => this.fetchTrendingFromDb(params.limit),
      );
    }

    return this.fetchTrendingFromDb(params.limit, params.cursor);
  }

  private async fetchTrendingFromDb(
    limit: number,
    cursor?: { score: number; createdAt: string; threadId: string } | null,
  ): Promise<TrendingDiscussionListItem[]> {
    // Per-thread comment aggregates. The previous implementation
    // re-executed correlated subqueries against `discussion_comments`
    // 3+ times per row (once in the cursor, once in `replyCount`,
    // once in `latestActivityAt`, and once in `trendingScore`).
    // With 20 rows per page that is 60–80 subquery executions per
    // request.
    //
    // We instead compute the aggregates in a single CTE pass and
    // LEFT JOIN the result to the threads query. The planner
    // can satisfy the CTE either with a hash aggregate over the
    // visible comment rows or with a nested-loop join driven by
    // the page of thread ids, but either way the per-thread
    // subqueries are gone.
    const threadCommentStats = this.db.$with('thread_comment_stats').as(
      this.db
        .select({
          threadId: discussionComments.threadId,
          recentCommentCount:
            sql<number>`COUNT(*) FILTER (WHERE ${discussionComments.createdAt} > NOW() - INTERVAL '7 days')::int`.as(
              'recent_comment_count',
            ),
          replyCount:
            sql<number>`COUNT(*) FILTER (WHERE ${discussionComments.parentCommentId} IS NOT NULL)::int`.as(
              'reply_count',
            ),
          latestCommentAt: sql<Date | null>`MAX(${discussionComments.createdAt})`.as(
            'latest_comment_at',
          ),
        })
        .from(discussionComments)
        .where(isNull(discussionComments.deletedAt))
        .groupBy(discussionComments.threadId),
    );

    // Score expression reused in both the cursor condition and
    // the ORDER BY. Defined once so the planner sees the same
    // expression in both places and can share derived state.
    // Note: CTE columns must use raw SQL identifiers (not Drizzle template
    // interpolation) because Drizzle cannot resolve ${threadCommentStats.col}
    // references at compile time.
    const scoreExpression = sql<number>`(
      ${discussionThreads.votesCount} * 3 +
      ${discussionThreads.commentsCount} * 2 +
      COALESCE(thread_comment_stats.recent_comment_count, 0)
    )::float`;

    const cursorCondition = cursor
      ? sql`(
          (${scoreExpression} < ${cursor.score})
          OR (
            ${scoreExpression} = ${cursor.score}
            AND ${discussionThreads.createdAt} > ${cursor.createdAt}
          )
          OR (
            ${scoreExpression} = ${cursor.score}
            AND ${discussionThreads.createdAt} = ${cursor.createdAt}
            AND ${discussionThreads.threadId} > ${cursor.threadId}
          )
        )`
      : undefined;

    const rows = await this.db
      .with(threadCommentStats)
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

        replyCount: sql<number>`COALESCE(thread_comment_stats.reply_count, 0)`,

        latestActivityAt: sql<Date>`GREATEST(
          ${discussionThreads.updatedAt},
          COALESCE(
            thread_comment_stats.latest_comment_at,
            ${discussionThreads.updatedAt}
          )
        )`,

        trendingScore: scoreExpression,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(threadCommentStats, eq(threadCommentStats.threadId, discussionThreads.threadId))
      .where(
        and(
          eq(discussionThreads.status, 'open'),
          isNull(discussionThreads.deletedAt),
          cursorCondition,
        ),
      )
      .orderBy(desc(scoreExpression), desc(discussionThreads.threadId))
      .limit(limit + 1);

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
    const sanitized = params.query.replace(/[():&|!<>]/g, ' ').trim();
    if (!sanitized) {
      return [];
    }

    const searchCondition = sql`${discussionThreads.discussionSearchVector} @@ websearch_to_tsquery('english', ${sanitized})`;

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
    const baseThread = this.db.$with('base_thread').as(
      this.db
        .select({
          threadId: discussionThreads.threadId,
          quizId: discussionThreads.quizId,
          titleTokens: sql<string[]>`ARRAY(
            SELECT DISTINCT token
            FROM unnest(regexp_split_to_array(lower(${discussionThreads.title}), E'\\W+')) AS token
            WHERE length(token) >= 3
          )`.as('title_tokens'),
        })
        .from(discussionThreads)
        .where(
          and(
            eq(discussionThreads.threadId, params.threadId),
            eq(discussionThreads.status, 'open'),
            isNull(discussionThreads.deletedAt),
          ),
        ),
    );

    const baseCategories = this.db
      .$with('base_categories')
      .as(
        this.db
          .select({ categoryId: quizzes.categoryId })
          .from(quizzes)
          .innerJoin(baseThread, eq(quizzes.quizId, baseThread.quizId)),
      );

    const candidateCategories = this.db.$with('candidate_categories').as(
      this.db
        .select({
          quizId: quizzes.quizId,
          categoryOverlap: count(quizzes.categoryId).as('category_overlap'),
        })
        .from(quizzes)
        .innerJoin(baseCategories, eq(quizzes.categoryId, baseCategories.categoryId))
        .where(sql`${quizzes.quizId} <> ${baseThread.quizId}`)
        .groupBy(quizzes.quizId),
    );

    const rows = await this.db
      .with(baseThread, baseCategories, candidateCategories)
      .select({
        threadId: discussionThreads.threadId,
        title: discussionThreads.title,
        commentCount: discussionThreads.commentsCount,
        voteCount: discussionThreads.votesCount,
        relevanceScore: sql<number>`(
          CASE WHEN ${discussionThreads.quizId} = ${baseThread.quizId} THEN 100 ELSE 0 END
          + COALESCE(${candidateCategories.categoryOverlap}, 0)::int * 20
        )`.as('relevance_score'),
      })
      .from(discussionThreads)
      .innerJoin(baseThread, sql`true`)
      .leftJoin(candidateCategories, eq(discussionThreads.quizId, candidateCategories.quizId))
      .where(
        and(
          eq(discussionThreads.status, 'open'),
          isNull(discussionThreads.deletedAt),
          sql`${discussionThreads.threadId} <> ${params.threadId}`,
          sql`(CASE WHEN ${discussionThreads.quizId} = ${baseThread.quizId} THEN 100 ELSE 0 END + COALESCE(${candidateCategories.categoryOverlap}, 0)::int * 20) > 0`,
        ),
      )
      .orderBy(
        desc(sql`relevance_score`),
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
    // Drizzle raw SQL returns untyped rows

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

  async listThreadSubscribers(threadId: string): Promise<{ userId: string }[]> {
    const rows = await this.db
      .select({ userId: discussionThreadSubscriptions.userId })
      .from(discussionThreadSubscriptions)
      .where(eq(discussionThreadSubscriptions.threadId, threadId));
    return rows;
  }

  async getThreadStats(threadId: string): Promise<ThreadStats | null> {
    const participantCountCTE = this.db.$with('participant_count').as(
      this.db
        .select({ count: count() })
        .from(discussionComments)
        .where(
          and(
            eq(discussionComments.threadId, threadId),
            isNull(discussionComments.deletedAt),
            isNotNull(discussionComments.authorId),
          ),
        ),
    );

    const rows = await this.db
      .with(participantCountCTE)
      .select({
        threadId: discussionThreads.threadId,
        commentsCount: discussionThreads.commentsCount,
        upvotesCount: discussionThreads.upvotesCount,
        downvotesCount: discussionThreads.downvotesCount,
        updatedAt: discussionThreads.updatedAt,
        totalReplies: sql<number>`COALESCE(SUM(${discussionComments.repliesCount}), 0)::int`,
        latestActivityAt: sql<string>`GREATEST(
          ${discussionThreads.updatedAt},
          COALESCE(
            (SELECT MAX(dc.created_at) FROM discussion_comments dc
             WHERE dc.thread_id = ${discussionThreads.threadId}
             AND dc.deleted_at IS NULL)::text,
            ${discussionThreads.updatedAt}
          )
        )`,
        participantCount: sql<number>`COALESCE((SELECT count FROM participant_count), 0)::int`,
      })
      .from(discussionThreads)
      .leftJoin(discussionComments, eq(discussionComments.threadId, discussionThreads.threadId))
      .where(and(eq(discussionThreads.threadId, threadId), isNull(discussionThreads.deletedAt)))
      .groupBy(
        discussionThreads.threadId,
        discussionThreads.commentsCount,
        discussionThreads.upvotesCount,
        discussionThreads.downvotesCount,
        discussionThreads.updatedAt,
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      threadId,
      totalComments: row.commentsCount,
      totalReplies: Number(row.totalReplies),
      totalParticipants: Number(row.participantCount),
      upvotes: row.upvotesCount,
      downvotes: row.downvotesCount,
      latestActivityAt: row.latestActivityAt,
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
        acceptedAnswers: sql<number>`COUNT(DISTINCT ${discussionComments.commentId})::int`,
      })
      .from(discussionComments)
      .innerJoin(
        discussionThreads,
        and(
          eq(discussionComments.commentId, discussionThreads.solvedCommentId),
          isNull(discussionThreads.deletedAt),
        ),
      )
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
      .returning({ threadId: discussionThreads.threadId });

    if (!updated) throw new Error('Thread not found or not authorized');
    return this.loadThreadWithAuthor(updated.threadId);
  }

  async softDeleteThread(
    params: { threadId: string; authorId: string },
    db?: DrizzleDB,
  ): Promise<void> {
    const client = db ?? this.db;
    const now = new Date().toISOString();
    await client
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

  async incrementThreadCommentCount(
    threadId: string,
    delta: number,
    db?: DrizzleDB | TransactionClient,
  ): Promise<void> {
    const client = db ?? this.db;
    await client
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
    db?: DrizzleDB,
  ): Promise<void> {
    const client = db ?? this.db;
    const totalDelta = deltaUpvotes + deltaDownvotes;
    await client
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

  async createComment(
    params: CreateCommentParams,
    db?: DrizzleDB | TransactionClient,
  ): Promise<DiscussionComment> {
    const client = db ?? this.db;
    const [comment] = await client
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

  /**
   * Transactional variant of `getThreadById`. Issues `SELECT … FOR UPDATE`
   * inside the supplied `tx` so the row is locked until the calling
   * transaction commits/rolls back. Used by services that mutate denormalized
   * counters under Fix #2 to close the TOCTOU window between the validation
   * read and the write — without it, a concurrent `softDeleteThread` could
   * slip in and leave `comments_count` incremented on a soft-deleted row.
   */
  async getThreadByIdForUpdate(
    threadId: string,
    tx: DrizzleDB | TransactionClient,
  ): Promise<DiscussionThread | null> {
    const rows = await tx
      .select({
        thread: discussionThreads,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(discussionThreads.threadId, threadId))
      .for('update')
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.enrichThread(row.thread as unknown as DiscussionThreadRow, {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
    });
  }

  /**
   * Transactional variant of `getCommentById` (mirror of
   * `getThreadByIdForUpdate`). Locks the row inside `tx` so concurrent
   * `softDeleteComment` / `deleteComment` on the same comment cannot
   * race the counter decrement under Fix #2.
   */
  async getCommentByIdForUpdate(
    commentId: string,
    tx: DrizzleDB | TransactionClient,
  ): Promise<DiscussionComment | null> {
    const rows = await tx
      .select({
        comment: discussionComments,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionComments)
      .innerJoin(users, eq(discussionComments.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(discussionComments.commentId, commentId))
      .for('update')
      .limit(1);

    const row = rows[0];
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

  async softDeleteComment(
    params: { commentId: string; authorId: string },
    db?: DrizzleDB | TransactionClient,
  ): Promise<void> {
    const client = db ?? this.db;
    const now = new Date().toISOString();
    await client
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

  async softDeleteCommentsByThread(threadId: string, db?: DrizzleDB): Promise<void> {
    const client = db ?? this.db;
    const now = new Date().toISOString();
    await client
      .update(discussionComments)
      .set({ deletedAt: now, updatedAt: now, status: 'deleted' })
      .where(and(eq(discussionComments.threadId, threadId), isNull(discussionComments.deletedAt)));
  }

  async incrementCommentRepliesCount(
    commentId: string,
    delta: number,
    db?: DrizzleDB | TransactionClient,
  ): Promise<void> {
    const client = db ?? this.db;
    await client
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
    db?: DrizzleDB,
  ): Promise<void> {
    const client = db ?? this.db;
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

  // ─── VOTES ──────────────────────────────────────────────────────────────────

  async upsertVote(params: VoteParams, db?: DrizzleDB): Promise<DiscussionVote> {
    const [vote] = await (db ?? this.db)
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

  async removeVote(
    params: {
      userId: string;
      targetType: 'thread' | 'comment';
      targetId: string;
    },
    db?: DrizzleDB,
  ): Promise<void> {
    const client = db ?? this.db;
    await client
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
    db?: DrizzleDB,
  ): Promise<DiscussionVoteValue | null> {
    const client = db ?? this.db;
    const [vote] = await client
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

  /**
   * Acquires a row-level lock on the vote row before updating.
   * Uses raw FOR UPDATE SQL — Drizzle 0.45 doesn't expose this through the query builder.
   * Must be called inside a transaction.
   */
  async getUserVoteForUpdate(
    userId: string,
    targetType: 'thread' | 'comment' | 'reply',
    targetId: string,
    db: DrizzleDB,
  ): Promise<DiscussionVoteValue | null> {
    // Drizzle raw SQL returns untyped rows
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await db
      .execute(
        sql`SELECT "value" FROM "discussion_votes" WHERE "user_id" = ${userId} AND "target_type" = ${targetType} AND "target_id" = ${targetId} FOR UPDATE`,
      )
      .catch(() => ({ rows: [] }));

    const vote = (result as { rows: { value: DiscussionVoteValue }[] }).rows[0];
    return vote?.value ?? null;
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

  private buildThreadFromRow(thread: DiscussionThreadRow, author: AuthorInfo): DiscussionThread {
    return {
      threadId: thread.threadId,
      quizId: thread.quizId,
      authorId: thread.authorId,
      author: { userId: thread.authorId, ...author },
      title: thread.title,
      body: thread.body,
      status: thread.status,
      isSolved: thread.isSolved,
      solvedAt: thread.solvedAt,
      solvedCommentId: thread.solvedCommentId,
      solvedBy: thread.solvedBy,
      commentsCount: thread.commentsCount,
      votesCount: thread.votesCount,
      upvotesCount: thread.upvotesCount,
      downvotesCount: thread.downvotesCount,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      deletedAt: thread.deletedAt,
    };
  }

  /**
   * Build a `DiscussionThread` domain object from a thread row and
   * its pre-loaded author.
   *
   * IMPORTANT: the author MUST be pre-loaded by the caller (via a
   * JOIN on `users`/`userProfiles`). We deliberately do NOT
   * accept a fallback that re-queries the database for the
   * author — that would let any caller silently introduce an N+1
   * in a list endpoint. If a future caller forgets the JOIN,
   * TypeScript will fail to compile because the second argument
   * is required.
   */
  private enrichThread(thread: DiscussionThreadRow, author: AuthorInfo): DiscussionThread {
    return this.buildThreadFromRow(thread, author);
  }

  /**
   * Single-row thread fetcher used by mutation methods
   * (create / update / solve / unsolve) that already issued a
   * write and only know the resulting `threadId`. Loads the
   * thread with its author JOIN'd in one roundtrip, so callers
   * do not have to re-run an extra query per thread.
   */
  private async loadThreadWithAuthor(threadId: string): Promise<DiscussionThread> {
    const [row] = await this.db
      .select({
        thread: discussionThreads,
        authorUsername: users.username,
        authorDisplayName: userProfiles.displayName,
        authorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(discussionThreads)
      .innerJoin(users, eq(discussionThreads.authorId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(discussionThreads.threadId, threadId));

    if (!row) {
      throw new Error(`Thread ${threadId} disappeared after write`);
    }

    return this.enrichThread(row.thread as unknown as DiscussionThreadRow, {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
    });
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

  async getUsernamesForUsers(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.db
      .select({ userId: users.userId, username: users.username })
      .from(users)
      .where(inArray(users.userId, userIds));

    return new Map(rows.map((r) => [r.userId, r.username]));
  }

  async getCommentAuthor(commentId: string): Promise<{ authorId: string } | null> {
    const [row] = await this.db
      .select({ authorId: discussionComments.authorId })
      .from(discussionComments)
      .where(eq(discussionComments.commentId, commentId))
      .limit(1);
    return row ?? null;
  }

  async getThreadAuthor(threadId: string): Promise<{ authorId: string } | null> {
    const [row] = await this.db
      .select({ authorId: discussionThreads.authorId })
      .from(discussionThreads)
      .where(eq(discussionThreads.threadId, threadId))
      .limit(1);
    return row ?? null;
  }

  async getReportReporter(reportId: string): Promise<{ reporterId: string } | null> {
    const [row] = await this.db
      .select({ reporterId: discussionReports.reporterId })
      .from(discussionReports)
      .where(eq(discussionReports.reportId, reportId))
      .limit(1);
    return row ?? null;
  }

  async getReportTargetSummary(params: {
    reportId: string;
    targetType: 'thread' | 'comment';
    targetId: string;
  }): Promise<{
    targetType: 'thread' | 'comment';
    targetId: string;
    threadId: string;
    threadTitle: string;
    excerpt: string;
  } | null> {
    const excerptLimit = 240;

    if (params.targetType === 'thread') {
      const [row] = await this.db
        .select({
          threadId: discussionThreads.threadId,
          title: discussionThreads.title,
          body: discussionThreads.body,
        })
        .from(discussionThreads)
        .where(eq(discussionThreads.threadId, params.targetId))
        .limit(1);

      if (!row) return null;

      return {
        targetType: 'thread',
        targetId: row.threadId,
        threadId: row.threadId,
        threadTitle: row.title,
        excerpt: row.body.length > excerptLimit ? `${row.body.slice(0, excerptLimit)}…` : row.body,
      };
    }

    const [row] = await this.db
      .select({
        commentId: discussionComments.commentId,
        threadId: discussionComments.threadId,
        threadTitle: discussionThreads.title,
        body: discussionComments.body,
      })
      .from(discussionComments)
      .innerJoin(discussionThreads, eq(discussionComments.threadId, discussionThreads.threadId))
      .where(eq(discussionComments.commentId, params.targetId))
      .limit(1);

    if (!row) return null;

    return {
      targetType: params.targetType,
      targetId: row.commentId,
      threadId: row.threadId,
      threadTitle: row.threadTitle,
      excerpt: row.body.length > excerptLimit ? `${row.body.slice(0, excerptLimit)}…` : row.body,
    };
  }

  async transactionally<T>(fn: (tx: DrizzleDB) => Promise<T>): Promise<T> {
    return this.db.transaction(fn as (tx: unknown) => Promise<T>);
  }
}
