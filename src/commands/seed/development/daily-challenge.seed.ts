import { eq } from 'drizzle-orm';
import { db, type SeedContext } from '../infrastructure';
import { SeedLookup } from '../shared/seed-lookup';
import {
  dailyChallenge,
  dailyChallengeAttempt,
  quizzes,
  quizVersions,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';
import type { SeedSummary } from '../infrastructure/types';

export const runDailyChallengeSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  let insertedChallenges = 0;
  let insertedAttempts = 0;

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    const quizSlug = 'javascript-fundamentals';
    const quizId = await lookup.quizIdBySlug(quizSlug);
    const quizVersionId = await lookup.publishedVersionIdByQuizSlug(quizSlug);
    const powerUserId = await lookup.userIdByUsername('power_user');

    if (!quizId || !quizVersionId) {
      logger.warn(`Daily challenge seed: quiz "${quizSlug}" or published version not found.`);
      return;
    }

    const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const [existing] = await tx
      .select({ challengeId: dailyChallenge.challengeId })
      .from(dailyChallenge)
      .where(eq(dailyChallenge.challengeDate, todayDate))
      .limit(1);

    let challengeId: string;

    if (existing) {
      challengeId = existing.challengeId;
    } else {
      const [created] = await tx
        .insert(dailyChallenge)
        .values({
          challengeDate: todayDate,
          quizId,
          quizVersionId,
          rewardXp: 150,
          totalQuestions: 5,
          createdAt: ctx.nowIso,
          expiresAt,
        })
        .returning({ challengeId: dailyChallenge.challengeId });
      challengeId = created.challengeId;
      insertedChallenges++;
    }

    // Add completed attempt for power_user
    const [existingAttempt] = await tx
      .select({ attemptId: dailyChallengeAttempt.attemptId })
      .from(dailyChallengeAttempt)
      .where(eq(dailyChallengeAttempt.challengeId, challengeId))
      .limit(1);

    if (!existingAttempt) {
      await tx.insert(dailyChallengeAttempt).values({
        challengeId,
        userId: powerUserId,
        answers: ['mock-opt-1', 'mock-opt-2', 'mock-opt-3', 'mock-opt-4', 'mock-opt-5'],
        nextQuestionIndex: 5,
        totalQuestions: 5,
        scorePercent: '100.00',
        completedAt: ctx.nowIso,
        createdAt: ctx.nowIso,
        updatedAt: ctx.nowIso,
      });
      insertedAttempts++;
    }

    logger.info(`Seeded daily challenge for date ${todayDate}`);
  });

  return [
    { domain: 'daily_challenge', inserted: insertedChallenges, updated: 0, skipped: 0 },
    { domain: 'daily_challenge_attempt', inserted: insertedAttempts, updated: 0, skipped: 0 },
  ];
};
