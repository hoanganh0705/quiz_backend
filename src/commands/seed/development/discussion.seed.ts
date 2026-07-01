import { eq } from 'drizzle-orm';
import { db, type SeedContext } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  discussionComments,
  discussionSavedThreads,
  discussionThreadSubscriptions,
  discussionThreads,
  discussionVotes,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

type DiscussionVoteSeed = {
  userUsername: string;
  targetType: 'thread' | 'comment' | 'reply';
  targetId: string;
  value: 'upvote' | 'downvote';
};

type DiscussionCommentSeed = {
  commentId: string;
  authorUsername: string;
  body: string;
  parentCommentId: string | null;
  repliesCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
};

type DiscussionThreadSeed = {
  threadId: string;
  quizSlug: string;
  authorUsername: string;
  title: string;
  body: string;
  status: 'open' | 'closed' | 'hidden' | 'deleted';
  isSolved: boolean;
  commentsCount: number;
  votesCount: number;
  upvotesCount: number;
  downvotesCount: number;
  solvedAt?: string;
  solvedCommentId?: string;
  solvedByUsername?: string;
  comments: DiscussionCommentSeed[];
  subscriptions: string[];
  savedBy: string[];
  votes: DiscussionVoteSeed[];
};

const DISCUSSION_THREAD_SEEDS: DiscussionThreadSeed[] = [
  {
    threadId: '11111111-1111-7111-8111-111111111111',
    quizSlug: 'javascript-fundamentals',
    authorUsername: 'learner_user',
    title: 'Why does `typeof null` return `object`?',
    body:
      'I got the question right, but I still do not fully understand why JavaScript reports `null` as an object. Is that behavior still important in modern code?',
    status: 'open' as const,
    isSolved: false,
    commentsCount: 2,
    votesCount: 2,
    upvotesCount: 2,
    downvotesCount: 0,
    comments: [
      {
        commentId: '11111111-1111-7111-8111-111111111112',
        authorUsername: 'content_author',
        body:
          'It is a long-standing JavaScript bug from the earliest implementation. You still see it today for compatibility reasons, so the practical takeaway is to avoid using `typeof` alone when you need to detect `null`.',
        parentCommentId: null,
        repliesCount: 1,
        votesCount: 1,
        upvotesCount: 1,
        downvotesCount: 0,
      },
      {
        commentId: '11111111-1111-7111-8111-111111111113',
        authorUsername: 'power_user',
        body:
          'A safer check is `value === null`, and for arrays use `Array.isArray(value)` instead of relying on `typeof`.',
        parentCommentId: '11111111-1111-7111-8111-111111111112',
        repliesCount: 0,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
      },
    ],
    subscriptions: ['content_author'],
    savedBy: ['power_user'],
    votes: [
      {
        userUsername: 'content_author',
        targetType: 'thread' as const,
        targetId: '11111111-1111-7111-8111-111111111111',
        value: 'upvote' as const,
      },
      {
        userUsername: 'power_user',
        targetType: 'thread' as const,
        targetId: '11111111-1111-7111-8111-111111111111',
        value: 'upvote' as const,
      },
      {
        userUsername: 'learner_user',
        targetType: 'comment' as const,
        targetId: '11111111-1111-7111-8111-111111111112',
        value: 'upvote' as const,
      },
    ],
  },
  {
    threadId: '22222222-2222-7222-8222-222222222222',
    quizSlug: 'system-design-v2',
    authorUsername: 'power_user',
    title: 'How should I think about reverse proxy vs load balancer here?',
    body:
      'The quiz mentions reverse proxies and load balancing in related concepts. I would love a mental model for when a reverse proxy is acting as the load balancer versus when those are separate layers.',
    status: 'open' as const,
    isSolved: true,
    commentsCount: 1,
    votesCount: 1,
    upvotesCount: 1,
    downvotesCount: 0,
    solvedAt: '2026-06-01T09:30:00.000Z',
    solvedCommentId: '22222222-2222-7222-8222-222222222223',
    solvedByUsername: 'power_user',
    comments: [
      {
        commentId: '22222222-2222-7222-8222-222222222223',
        authorUsername: 'content_author',
        body:
          'A reverse proxy sits in front of servers and can provide caching, TLS termination, and routing. Load balancing is one capability it may provide, but not every reverse proxy setup is primarily about balancing traffic.',
        parentCommentId: null,
        repliesCount: 0,
        votesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
      },
    ],
    subscriptions: ['learner_user'],
    savedBy: ['content_author'],
    votes: [
      {
        userUsername: 'learner_user',
        targetType: 'thread' as const,
        targetId: '22222222-2222-7222-8222-222222222222',
        value: 'upvote' as const,
      },
    ],
  },
];

export const runDiscussionSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let threadsInserted = 0;
    let commentsInserted = 0;
    let votesInserted = 0;
    let subscriptionsInserted = 0;
    let savesInserted = 0;
    let skipped = 0;

    for (const seed of DISCUSSION_THREAD_SEEDS) {
      const quizId = await lookup.quizIdBySlug(seed.quizSlug);
      if (!quizId) {
        logger.warn(`Discussion seed: quiz "${seed.quizSlug}" not found, skipping thread "${seed.title}"`);
        skipped++;
        continue;
      }

      const authorId = await lookup.userIdByUsername(seed.authorUsername);
      const solvedBy = seed.solvedByUsername
        ? await lookup.userIdByUsername(seed.solvedByUsername)
        : null;

      const [existingThread] = await tx
        .select({ threadId: discussionThreads.threadId })
        .from(discussionThreads)
        .where(eq(discussionThreads.threadId, seed.threadId))
        .limit(1);

      if (!existingThread) {
        await tx.insert(discussionThreads).values({
          threadId: seed.threadId,
          quizId,
          authorId,
          title: seed.title,
          body: seed.body,
          status: seed.status,
          commentsCount: seed.commentsCount,
          votesCount: seed.votesCount,
          upvotesCount: seed.upvotesCount,
          downvotesCount: seed.downvotesCount,
          isSolved: seed.isSolved,
          solvedAt: seed.solvedAt ?? null,
          solvedCommentId: seed.solvedCommentId ?? null,
          solvedBy,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        });
        threadsInserted++;
      } else {
        skipped++;
      }

      for (const comment of seed.comments) {
        const authorId = await lookup.userIdByUsername(comment.authorUsername);
        const [existingComment] = await tx
          .select({ commentId: discussionComments.commentId })
          .from(discussionComments)
          .where(eq(discussionComments.commentId, comment.commentId))
          .limit(1);

        if (existingComment) continue;

        await tx.insert(discussionComments).values({
          commentId: comment.commentId,
          threadId: seed.threadId,
          authorId,
          parentCommentId: comment.parentCommentId,
          body: comment.body,
          repliesCount: comment.repliesCount,
          votesCount: comment.votesCount,
          upvotesCount: comment.upvotesCount,
          downvotesCount: comment.downvotesCount,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        });
        commentsInserted++;
      }

      for (const username of seed.subscriptions) {
        const userId = await lookup.userIdByUsername(username);
        const inserted = await tx
          .insert(discussionThreadSubscriptions)
          .values({
            userId,
            threadId: seed.threadId,
            createdAt: ctx.nowIso,
          })
          .onConflictDoNothing()
          .returning({ threadId: discussionThreadSubscriptions.threadId });

        subscriptionsInserted += inserted.length;
      }

      for (const username of seed.savedBy) {
        const userId = await lookup.userIdByUsername(username);
        const inserted = await tx
          .insert(discussionSavedThreads)
          .values({
            userId,
            threadId: seed.threadId,
            createdAt: ctx.nowIso,
          })
          .onConflictDoNothing()
          .returning({ threadId: discussionSavedThreads.threadId });

        savesInserted += inserted.length;
      }

      for (const vote of seed.votes) {
        const userId = await lookup.userIdByUsername(vote.userUsername);
        const inserted = await tx
          .insert(discussionVotes)
          .values({
            userId,
            targetType: vote.targetType,
            targetId: vote.targetId,
            value: vote.value,
            createdAt: ctx.nowIso,
            updatedAt: ctx.nowIso,
          })
          .onConflictDoNothing()
          .returning({ voteId: discussionVotes.voteId });

        votesInserted += inserted.length;
      }

      logger.info(`Discussion thread seeded: "${seed.title}" for quiz "${seed.quizSlug}"`);
    }

    summaries.push({
      domain: 'discussions',
      inserted: threadsInserted + commentsInserted + votesInserted + subscriptionsInserted + savesInserted,
      updated: 0,
      skipped,
    });
  });

  return summaries;
};
