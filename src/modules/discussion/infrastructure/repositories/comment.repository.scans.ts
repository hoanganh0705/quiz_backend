/**
 * Drizzle scan helpers for the comment repository.
 *
 * Each helper wraps a single SQL query against the comment schema
 * and returns a plain domain shape. The repository composes them
 * into the public methods; the helpers do not know about the
 * repository port.
 *
 * Why isolated: the per-comment author join is duplicated across
 * every read path, and the cursor + filter conditions overlap. A
 * single source of truth here makes the SQL auditable in one place.
 */

import { and, desc, eq, inArray, isNull, sql, asc } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  discussionComments,
  discussionCommentReports,
  discussionCommentVotes,
  userProfiles,
  users,
} from '@/core/database/schema';
import type {
  AuthorView,
  CommentCursor,
  CommentView,
  ListMyCommentsParams,
  ReportCursor,
  ReportStatus,
  ReportView,
} from '../../domain/types';

type CommentRow = typeof discussionComments.$inferSelect;

// ─── Author join (single-row) ───────────────────────────────────────────────

async function joinAuthorById(
  db: DrizzleDB,
  userId: string,
): Promise<AuthorView | null> {
  const [row] = await db
    .select({
      username: users.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
    .where(eq(users.userId, userId))
    .limit(1);

  if (!row) return null;
  return {
    userId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

/**
 * Same join, fan-out across many comment rows in one round-trip.
 * Returns a `Map<commentId, AuthorView>` keyed by the comment's
 * `authorId` (callers should pre-group the comments by `authorId`
 * to use the lookup; the map is keyed by userId for fan-out reads).
 */
async function joinAuthorsByIds(
  db: DrizzleDB,
  userIds: string[],
): Promise<Map<string, AuthorView>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: users.userId,
      username: users.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
    .where(inArray(users.userId, userIds));

  const map = new Map<string, AuthorView>();
  for (const row of rows) {
    map.set(row.userId, {
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    });
  }
  return map;
}

// ─── Row → Comment view ─────────────────────────────────────────────────────

interface CommentAuthorForViewInput {
  row: CommentRow;
  author: AuthorView;
}

/**
 * Convert a raw `discussion_comments` row + pre-joined author into
 * a `CommentView`. The field projection mirrors the column shape in
 * `core/database/schema/comment/schema.ts` (`commentId` → `id`,
 * `isHidden` → `isHidden`).
 */
export function commentAuthorForView(input: CommentAuthorForViewInput): CommentView {
  const { row, author } = input;
  return {
    id: row.commentId,
    quizId: row.quizId,
    authorId: row.authorId,
    author,
    parentCommentId: row.parentCommentId,
    body: row.body,
    isHidden: row.isHidden,
    hiddenById: row.hiddenById,
    hiddenAt: row.hiddenAt,
    votesCount: row.votesCount,
    upvotesCount: row.upvotesCount,
    downvotesCount: row.downvotesCount,
    repliesCount: row.repliesCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

async function rowToCommentView(db: DrizzleDB, row: CommentRow): Promise<CommentView> {
  const author = await joinAuthorById(db, row.authorId);
  if (!author) {
    return commentAuthorForView({
      row,
      author: { userId: row.authorId, username: '', displayName: null, avatarUrl: null },
    });
  }
  return commentAuthorForView({ row, author });
}

// ─── Cursor pagination primitive ────────────────────────────────────────────

/**
 * `(createdAt desc, id desc)` cursor condition. Appended to
 * the `WHERE` clause. The caller's `cursor` is the last seen
 * `(createdAt, id)` pair.
 */
function cursorDesc(cursor: CommentCursor | null | undefined) {
  if (!cursor) return undefined;
  return sql`(
    ${discussionComments.createdAt} < ${cursor.createdAt}
    OR (
      ${discussionComments.createdAt} = ${cursor.createdAt}
      AND ${discussionComments.commentId} < ${cursor.id}
    )
  )`;
}

// ─── Top-level comment scan ─────────────────────────────────────────────────

export interface TopLevelScanOptions {
  quizId: string;
  limit: number;
  cursor?: CommentCursor | null;
}

/**
 * Scan the per-quiz top-level comment feed. Returns one extra row
 * beyond `limit` so the caller can detect `hasNextPage`.
 *
 * Uses the two-level index
 * `idx_discussion_comments_quiz_parent_created` to satisfy the
 * filter + sort in a single index scan.
 */
export async function topLevelCommentScan(
  db: DrizzleDB,
  options: TopLevelScanOptions,
): Promise<{ items: CommentView[]; hasNextPage: boolean }> {
  const cursorCondition = cursorDesc(options.cursor);
  const rows = await db
    .select()
    .from(discussionComments)
    .where(
      and(
        eq(discussionComments.quizId, options.quizId),
        isNull(discussionComments.parentCommentId),
        isNull(discussionComments.deletedAt),
        cursorCondition,
      ),
    )
    .orderBy(desc(discussionComments.createdAt), desc(discussionComments.commentId))
    .limit(options.limit + 1);

  const hasNextPage = rows.length > options.limit;
  const trimmed = hasNextPage ? rows.slice(0, options.limit) : rows;
  const authorIds = [...new Set(trimmed.map((r) => r.authorId))];
  const authorMap = await joinAuthorsByIds(db, authorIds);

  const items = trimmed.map((row) =>
    commentAuthorForView({
      row,
      author:
        authorMap.get(row.authorId) ?? {
          userId: row.authorId,
          username: '',
          displayName: null,
          avatarUrl: null,
        },
    }),
  );

  return { items, hasNextPage };
}

// ─── Reply scan ─────────────────────────────────────────────────────────────

/**
 * Fetch all replies for a batch of top-level comment ids in one
 * round-trip. The DB filter is `parent_comment_id IN (…)`. Per-parent
 * truncation is applied at the application layer (the legacy
 * per-parent limit pre-dates the two-level rule; the comment module
 * drops the per-parent truncation after the `MAX_REPLIES_PER_COMMENT`
 * cap is enforced at the write path, but the read path still
 * truncates to keep wire payloads bounded).
 */
export async function multiReplyScan(
  db: DrizzleDB,
  topLevelIds: string[],
  limitPerParent: number,
): Promise<CommentView[]> {
  if (topLevelIds.length === 0) return [];

  const rows = await db
    .select()
    .from(discussionComments)
    .where(
      and(
        inArray(discussionComments.parentCommentId, topLevelIds),
        isNull(discussionComments.deletedAt),
      ),
    )
    .orderBy(asc(discussionComments.createdAt));

  const result: CommentView[] = [];
  const countByParent = new Map<string, number>();
  const authorIds = new Set<string>();

  for (const row of rows) {
    const parentId = row.parentCommentId!;
    const count = countByParent.get(parentId) ?? 0;
    if (count >= limitPerParent) continue;
    authorIds.add(row.authorId);
    countByParent.set(parentId, count + 1);
  }

  const authorMap = await joinAuthorsByIds(db, [...authorIds]);

  for (const row of rows) {
    const parentId = row.parentCommentId!;
    const count = countByParent.get(parentId) ?? 0;
    if (count >= limitPerParent) continue;
    result.push(
      commentAuthorForView({
        row,
        author:
          authorMap.get(row.authorId) ?? {
            userId: row.authorId,
            username: '',
            displayName: null,
            avatarUrl: null,
          },
      }),
    );
    countByParent.set(parentId, count + 1);
  }

  return result;
}

// ─── My-activity scan ───────────────────────────────────────────────────────

/**
 * "My comments" feed: the caller's comments (visible + hidden, joined
 * to the parent comment for the `quizTitle` summary). Cursor is
 * `(createdAt desc, commentId desc)`.
 */
export async function paginatedCommentScan(
  db: DrizzleDB,
  params: ListMyCommentsParams & { limit: number },
): Promise<import('../../domain/types').MyCommentView[]> {
  const limit = params.limit;
  const cursorCondition = cursorDesc(params.cursor);

  const rows = await db
    .select({
      commentId: discussionComments.commentId,
      quizId: discussionComments.quizId,
      body: discussionComments.body,
      votesCount: discussionComments.votesCount,
      repliesCount: discussionComments.repliesCount,
      createdAt: discussionComments.createdAt,
      updatedAt: discussionComments.updatedAt,
    })
    .from(discussionComments)
    .where(
      and(
        eq(discussionComments.authorId, params.userId),
        isNull(discussionComments.deletedAt),
        cursorCondition,
      ),
    )
    .orderBy(desc(discussionComments.createdAt), desc(discussionComments.commentId))
    .limit(limit + 1);

  // Pagination follows the limit+1 probe convention. The caller
  // slices the last item off and uses it to compute the next cursor.
  const hasNextPage = rows.length > limit;
  const trimmed = hasNextPage ? rows.slice(0, limit) : rows;

  return trimmed.map((row) => ({
    commentId: row.commentId,
    quizId: row.quizId,
    quizTitle: '', // populated by the application layer if needed
    body: row.body,
    votesCount: row.votesCount,
    repliesCount: row.repliesCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

// ─── Report scan ────────────────────────────────────────────────────────────

export interface ReportScanOptions {
  status?: ReportStatus | undefined;
  limit?: number;
  cursor?: ReportCursor | null;
}

export async function reportScan(
  db: DrizzleDB,
  options: ReportScanOptions,
): Promise<{
  items: ReportView[];
  hasNextPage: boolean;
}> {
  const limit = options.limit ?? 20;
  const conditions = [isNull(discussionComments.deletedAt)];
  // The `reportId` cursor is the chronological tiebreaker on `createdAt`.
  if (options.status) {
    conditions.push(eq(discussionCommentReports.status, options.status));
  }
  if (options.cursor) {
    conditions.push(
      sql`(
        ${discussionCommentReports.createdAt} < ${options.cursor.createdAt}
        OR (
          ${discussionCommentReports.createdAt} = ${options.cursor.createdAt}
          AND ${discussionCommentReports.reportId} < ${options.cursor.id}
        )
      )`,
    );
  }

  const rows = await db
    .select()
    .from(discussionCommentReports)
    .innerJoin(
      discussionComments,
      eq(discussionCommentReports.commentId, discussionComments.commentId),
    )
    .where(and(...conditions))
    .orderBy(desc(discussionCommentReports.createdAt), desc(discussionCommentReports.reportId))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const trimmed = hasNextPage ? rows.slice(0, limit) : rows;

  type JoinedRow = (typeof rows)[number];
  const items: import('../../domain/types').ReportView[] = trimmed.map((row: JoinedRow) => {
    const report = (row as unknown as { discussion_comment_reports: typeof discussionCommentReports.$inferSelect })
      .discussion_comment_reports;
    return {
      reportId: report.reportId,
      reporterId: report.reporterId,
      commentId: report.commentId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      reviewedByUserId: report.reviewedByUserId,
      reviewedAt: report.reviewedAt,
      actionTaken: report.actionTaken,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  });

  return { items, hasNextPage };
}

// `rowToCommentView` is reserved for the per-single-row read path
// used by the `SELECT … FOR UPDATE` variants. It is currently
// inlined by the repository; re-exported here so future callers
// can access the same row-shape conversion.
export { rowToCommentView };

// Re-exports for tools that load these helpers standalone.
export { joinAuthorById, joinAuthorsByIds };