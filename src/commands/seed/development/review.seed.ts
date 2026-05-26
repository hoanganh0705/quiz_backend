import { db, type SeedContext } from '../infrastructure';
import type { SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import { quizReviews } from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

const REVIEW_SEEDS = [
  {
    userUsername: 'learner_user',
    quizSlug: 'javascript-fundamentals',
    rating: 5,
    comment: 'Excellent quiz! Great questions that really test your understanding of JavaScript basics.',
  },
  {
    userUsername: 'power_user',
    quizSlug: 'javascript-fundamentals',
    rating: 4,
    comment: 'Good coverage of fundamentals. Some questions felt a bit too straightforward.',
  },
  {
    userUsername: 'power_user',
    quizSlug: 'system-design-v2',
    rating: 5,
    comment: 'Challenging but fair. The questions cover real-world scenarios you would encounter in system design interviews.',
  },
];

export const runReviewSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    let inserted = 0;
    let skipped = 0;

    for (const review of REVIEW_SEEDS) {
      const userId = await lookup.userIdByUsername(review.userUsername);
      const quizId = await lookup.quizIdBySlug(review.quizSlug);

      if (!quizId) {
        logger.warn(`Review seed: quiz "${review.quizSlug}" not found, skipping`);
        skipped++;
        continue;
      }

      await tx
        .insert(quizReviews)
        .values({
          quizId,
          userId,
          rating: review.rating,
          comment: review.comment,
          createdAt: ctx.nowIso,
          updatedAt: ctx.nowIso,
        })
        .onConflictDoNothing()
        .returning();

      inserted++;
      logger.info(`Review: ${review.userUsername} rated "${review.quizSlug}" ${review.rating}/5`);
    }

    summaries.push({ domain: 'reviews', inserted, updated: 0, skipped });
  });

  return summaries;
};
