// =============================================================================
// Comment seed (Phase 9.x — replaces the legacy Q/A thread discussion seed)
//
// Seeds the per-quiz comment section: top-level comments + one-level replies,
// per-user votes, and moderator reports. The Q/A-era concepts (threads,
// subscriptions, saved threads, solve marking) no longer exist, so the seed
// writes only what the post-refactor schema models.
//
// Order of writes inside the transaction:
//   1. top-level comments (parentCommentId = null)
//   2. replies (parentCommentId = <a top-level commentId>)
//   3. votes (one per (user, comment))
//   4. reports (one per (reporter, comment))
//
// Subscriptions, saved-threads, and "thread-level" votes were removed by
// the comment refactor; if they ever need to come back, they belong in
// their own bounded context, not in this seed.
// =============================================================================

import { eq } from 'drizzle-orm';
import { db, type SeedContext, recorder } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  discussionComments,
  discussionCommentVotes,
  discussionCommentReports,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

type CommentVoteSeed = {
  userUsername: string;
  commentId: string;
  value: 'upvote' | 'downvote';
};

type CommentReportSeed = {
  reporterUsername: string;
  commentId: string;
  reason: string;
  status?: 'open' | 'dismissed' | 'actioned';
  reviewedByUsername?: string;
};

type CommentSeed = {
  commentId: string;
  quizSlug: string;
  authorUsername: string;
  body: string;
  parentCommentId: string | null;
  repliesCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  isHidden?: boolean;
  votes: CommentVoteSeed[];
  reports: CommentReportSeed[];
};

const COMMENT_SEEDS: CommentSeed[] = [
  {
    commentId: '11111111-1111-7111-8111-111111111112',
    quizSlug: 'javascript-fundamentals',
    authorUsername: 'content_author',
    body: 'It is a long-standing JavaScript bug from the earliest implementation. You still see it today for compatibility reasons, so the practical takeaway is to avoid using `typeof` alone when you need to detect `null`.',
    parentCommentId: null,
    repliesCount: 1,
    votesCount: 1,
    upvotesCount: 1,
    downvotesCount: 0,
    votes: [
      { userUsername: 'learner_user', commentId: '11111111-1111-7111-8111-111111111112', value: 'upvote' },
    ],
    reports: [],
  },
  {
    commentId: '11111111-1111-7111-8111-111111111113',
    quizSlug: 'javascript-fundamentals',
    authorUsername: 'power_user',
    body: 'A safer check is `value === null`, and for arrays use `Array.isArray(value)` instead of relying on `typeof`.',
    parentCommentId: '11111111-1111-7111-8111-111111111112',
    repliesCount: 0,
    votesCount: 0,
    upvotesCount: 0,
    downvotesCount: 0,
    votes: [],
    reports: [],
  },
  {
    commentId: '22222222-2222-7222-8222-222222222223',
    quizSlug: 'system-design-v2',
    authorUsername: 'content_author',
    body: 'A reverse proxy sits in front of servers and can provide caching, TLS termination, and routing. Load balancing is one capability it may provide, but not every reverse proxy setup is primarily about balancing traffic.',
    parentCommentId: null,
    repliesCount: 0,
    votesCount: 1,
    upvotesCount: 1,
    downvotesCount: 0,
    votes: [
      { userUsername: 'learner_user', commentId: '22222222-2222-7222-8222-222222222223', value: 'upvote' },
    ],
    reports: [
      {
        reporterUsername: 'power_user',
        commentId: '22222222-2222-7222-8222-222222222223',
        reason: 'spam',
        status: 'dismissed',
        reviewedByUsername: 'admin_user',
      },
    ],
  },
];

export const runDiscussionSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let commentsInserted = 0;
    let votesInserted = 0;
    let reportsInserted = 0;
    let skipped = 0;

    for (const seed of COMMENT_SEEDS) {
      const quizId = await lookup.quizIdBySlug(seed.quizSlug);
      if (!quizId) {
        logger.warn(
          `Comment seed: quiz "${seed.quizSlug}" not found, skipping comment "${seed.commentId}"`,
        );
        skipped++;
        continue;
      }

      const authorId = await lookup.userIdByUsername(seed.authorUsername);

      const [existing] = await tx
        .select({ commentId: discussionComments.commentId })
        .from(discussionComments)
        .where(eq(discussionComments.commentId, seed.commentId))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await tx.insert(discussionComments).values({
        commentId: seed.commentId,
        quizId,
        authorId,
        parentCommentId: seed.parentCommentId,
        body: seed.body,
        isHidden: seed.isHidden ?? false,
        repliesCount: seed.repliesCount,
        votesCount: seed.votesCount,
        upvotesCount: seed.upvotesCount,
        downvotesCount: seed.downvotesCount,
        createdAt: ctx.nowIso,
        updatedAt: ctx.nowIso,
      });
      commentsInserted++;

      recorder.record({
        kind: 'Comments',
        id: seed.commentId,
        fields: {
          commentId: seed.commentId,
          quizSlug: seed.quizSlug,
          author: seed.authorUsername,
          parentCommentId: seed.parentCommentId ?? '',
          body: seed.body.length > 80 ? seed.body.slice(0, 80) + '...' : seed.body,
          repliesCount: String(seed.repliesCount),
          votesCount: String(seed.votesCount),
        },
        details: {
          commentId: seed.commentId,
          quizId,
          authorId,
          authorUsername: seed.authorUsername,
          parentCommentId: seed.parentCommentId,
          body: seed.body,
          repliesCount: seed.repliesCount,
          votesCount: seed.votesCount,
          upvotesCount: seed.upvotesCount,
          downvotesCount: seed.downvotesCount,
          isHidden: seed.isHidden ?? false,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        },
      });

      for (const vote of seed.votes) {
        const userId = await lookup.userIdByUsername(vote.userUsername);

        const inserted = await tx
          .insert(discussionCommentVotes)
          .values({
            userId,
            commentId: vote.commentId,
            value: vote.value,
            createdAt: ctx.nowIso,
            updatedAt: ctx.nowIso,
          })
          .onConflictDoNothing()
          .returning({ voteId: discussionCommentVotes.voteId });

        votesInserted += inserted.length;

        if (inserted.length > 0) {
          recorder.record({
            kind: 'Comment Votes',
            id: inserted[0].voteId,
            fields: {
              voteId: inserted[0].voteId,
              username: vote.userUsername,
              commentId: vote.commentId,
              value: vote.value,
            },
            details: {
              voteId: inserted[0].voteId,
              userId,
              commentId: vote.commentId,
              value: vote.value,
              createdAt: ctx.nowIso,
              updatedAt: ctx.nowIso,
            },
          });
        }
      }

      for (const report of seed.reports) {
        const reporterId = await lookup.userIdByUsername(report.reporterUsername);
        const reviewedByUserId = report.reviewedByUsername
          ? await lookup.userIdByUsername(report.reviewedByUsername)
          : null;

        const inserted = await tx
          .insert(discussionCommentReports)
          .values({
            reporterId,
            commentId: report.commentId,
            reason: report.reason,
            status: report.status ?? 'open',
            reviewedByUserId,
            reviewedAt: report.status && report.status !== 'open' ? ctx.nowIso : null,
            actionTaken: report.status === 'actioned',
            createdAt: ctx.nowIso,
            updatedAt: ctx.nowIso,
          })
          .onConflictDoNothing()
          .returning({ reportId: discussionCommentReports.reportId });

        reportsInserted += inserted.length;

        if (inserted.length > 0) {
          recorder.record({
            kind: 'Comment Reports',
            id: inserted[0].reportId,
            fields: {
              reportId: inserted[0].reportId,
              reporter: report.reporterUsername,
              commentId: report.commentId,
              reason: report.reason,
              status: report.status ?? 'open',
            },
            details: {
              reportId: inserted[0].reportId,
              reporterId,
              commentId: report.commentId,
              reason: report.reason,
              status: report.status ?? 'open',
              reviewedByUserId,
              reviewedAt: report.status && report.status !== 'open' ? ctx.nowIso : null,
              actionTaken: report.status === 'actioned',
              createdAt: ctx.nowIso,
              updatedAt: ctx.nowIso,
            },
          });
        }
      }

      logger.info(
        `Comment seeded: "${seed.commentId.slice(0, 8)}…" on quiz "${seed.quizSlug}" (author=${seed.authorUsername})`,
      );
    }

    summaries.push({
      domain: 'comments',
      inserted: commentsInserted + votesInserted + reportsInserted,
      updated: 0,
      skipped,
    });
  });

  return summaries;
};
