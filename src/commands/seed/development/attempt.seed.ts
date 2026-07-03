import { eq, sql } from 'drizzle-orm';
import { db, type SeedContext, type SeedTx } from '../infrastructure';
import type { AttemptSeed, SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  quizAttempts,
  quizAttemptAnswers,
  quizAnswerOptions,
  quizQuestions,
  users,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

const ATTEMPT_SEEDS: AttemptSeed[] = [
  {
    // att-001: power_user perfect score on javascript-fundamentals v1
    attemptId: 'a0000001-0000-7000-8000-000000000001',
    userUsername: 'power_user',
    quizSlug: 'javascript-fundamentals',
    versionNumber: 1,
    status: 'completed',
    scorePercent: '100.00',
    correctCount: 5,
    timeTakenMs: 180_000,
    xpEarned: 100,
  },
  {
    // att-002: learner_user passed javascript-fundamentals v1
    attemptId: 'a0000002-0000-7000-8000-000000000002',
    userUsername: 'learner_user',
    quizSlug: 'javascript-fundamentals',
    versionNumber: 1,
    status: 'completed',
    scorePercent: '80.00',
    correctCount: 4,
    timeTakenMs: 240_000,
    xpEarned: 100,
  },
  {
    // att-003: learner_user failed javascript-fundamentals v1
    attemptId: 'a0000003-0000-7000-8000-000000000003',
    userUsername: 'learner_user',
    quizSlug: 'javascript-fundamentals',
    versionNumber: 1,
    status: 'completed',
    scorePercent: '40.00',
    correctCount: 2,
    timeTakenMs: 300_000,
    xpEarned: 0,
  },
  {
    // att-004: power_user passed system-design-v2 v2
    attemptId: 'a0000004-0000-7000-8000-000000000004',
    userUsername: 'power_user',
    quizSlug: 'system-design-v2',
    versionNumber: 2,
    status: 'completed',
    scorePercent: '83.33',
    correctCount: 5,
    timeTakenMs: 600_000,
    xpEarned: 250,
  },
  {
    // att-005: learner_user abandoned system-design-v2 v2
    attemptId: 'a0000005-0000-7000-8000-000000000005',
    userUsername: 'learner_user',
    quizSlug: 'system-design-v2',
    versionNumber: 2,
    status: 'abandoned',
  },
  {
    // att-006: power_user abandoned algorithms-advanced v1
    attemptId: 'a0000006-0000-7000-8000-000000000006',
    userUsername: 'power_user',
    quizSlug: 'algorithms-advanced',
    versionNumber: 1,
    status: 'abandoned',
  },
  {
    // att-007: learner_user in-progress on algorithms-advanced v1
    attemptId: 'a0000007-0000-7000-8000-000000000007',
    userUsername: 'learner_user',
    quizSlug: 'algorithms-advanced',
    versionNumber: 1,
    status: 'started',
  },
];

export { ATTEMPT_SEEDS };

async function getCorrectOptionIds(tx: SeedTx, quizVersionId: string): Promise<Map<string, string>> {
  const rows = await tx
    .select({
      questionId: quizQuestions.questionId,
      optionId: quizAnswerOptions.optionId,
    })
    .from(quizQuestions)
    .innerJoin(quizAnswerOptions, eq(quizAnswerOptions.questionId, quizQuestions.questionId))
    .where(sql`${quizQuestions.quizVersionId} = ${quizVersionId} AND ${quizAnswerOptions.isCorrect} = true`);

  return new Map(rows.map((r) => [r.questionId, r.optionId]));
}

export const runAttemptSeed = async (): Promise<SeedSummary[]> => {
  const ctx: SeedContext = { nowIso: new Date().toISOString() };
  const summaries: SeedSummary[] = [];

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);

    let inserted = 0;
    let skipped = 0;

    for (const attempt of ATTEMPT_SEEDS) {
      const userId = await lookup.userIdByUsername(attempt.userUsername);
      const quizVersionId = await lookup.quizVersionIdBySlugAndNumber(
        attempt.quizSlug,
        attempt.versionNumber,
      );

      if (!quizVersionId) {
        logger.warn(`Skipping attempt for unknown quiz "${attempt.quizSlug}" v${attempt.versionNumber}`);
        skipped++;
        continue;
      }

      const [existing] = await tx
        .select({ attemptId: quizAttempts.attemptId })
        .from(quizAttempts)
        .where(eq(quizAttempts.attemptId, attempt.attemptId))
        .limit(1);

      if (existing) {
        skipped++;
        logger.info(`Skipped existing attempt: ${attempt.attemptId}`);
        continue;
      }

      const startedAt = new Date(Date.now() - 3_600_000).toISOString();
      const finishedAt = attempt.status === 'completed'
        ? new Date(Date.now() - 3_500_000).toISOString()
        : null;

      await tx.insert(quizAttempts).values({
        attemptId: attempt.attemptId,
        userId,
        quizVersionId,
        contextType: 'solo',
        contextRefId: null,
        status: attempt.status,
        scorePercent: attempt.scorePercent ?? null,
        correctCount: attempt.correctCount ?? null,
        startedAt,
        finishedAt,
        timeTakenMs: attempt.timeTakenMs ?? null,
        xpEarned: attempt.xpEarned ?? 0,
        createdAt: startedAt,
        updatedAt: finishedAt ?? startedAt,
      });

      if (attempt.status === 'completed' && attempt.correctCount !== undefined) {
        const correctMap = await getCorrectOptionIds(tx, quizVersionId);
        for (const [questionId, optionId] of correctMap) {
          await tx.insert(quizAttemptAnswers).values({
            attemptId: attempt.attemptId,
            questionId,
            selectedOptionId: optionId,
            answeredAt: startedAt,
            timeTakenMs: Math.floor(Math.random() * 30_000) + 5_000,
          }).onConflictDoNothing();
        }
      }

      if (attempt.xpEarned && attempt.xpEarned > 0) {
        await tx
          .update(users)
          .set({ xpTotal: sql`${users.xpTotal} + ${attempt.xpEarned}` })
          .where(eq(users.userId, userId));
      }

      // NOTE: quiz_stats is ❌ DO NOT SEED — it is recomputed by the background
      // job after each completed attempt. Writing it here would diverge from
      // real attempt counts the moment a real API attempt is recorded.

      inserted++;
      logger.info(`Created attempt ${attempt.attemptId} (${attempt.status}) for ${attempt.userUsername} on ${attempt.quizSlug}`);
    }

    summaries.push({ domain: 'attempts', inserted, updated: 0, skipped });
  });

  return summaries;
};
