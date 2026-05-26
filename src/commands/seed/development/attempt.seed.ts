import { eq, sql } from 'drizzle-orm';
import { db, type SeedContext, type SeedTx } from '../infrastructure';
import type { AttemptSeed, SeedSummary } from '../infrastructure/types';
import { SeedLookup } from '../shared/seed-lookup';
import {
  quizAttempts,
  quizAttemptAnswers,
  quizAnswerOptions,
  quizQuestions,
  quizStats,
  quizVersions,
  users,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';

const ATTEMPT_SEEDS: AttemptSeed[] = [
  {
    attemptId: 'att-001-power-learner-perfect',
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
    attemptId: 'att-002-learner-passed',
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
    attemptId: 'att-003-learner-failed',
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
    attemptId: 'att-004-power-learner-system-design',
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
    attemptId: 'att-005-learner-abandoned',
    userUsername: 'learner_user',
    quizSlug: 'system-design-v2',
    versionNumber: 2,
    status: 'abandoned',
  },
  {
    attemptId: 'att-006-power-learner-abandoned',
    userUsername: 'power_user',
    quizSlug: 'algorithms-advanced',
    versionNumber: 1,
    status: 'abandoned',
  },
  {
    attemptId: 'att-007-learner-active',
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

      if (attempt.status === 'completed' && attempt.scorePercent) {
        const [qv] = await tx
          .select({ quizId: quizVersions.quizId })
          .from(quizVersions)
          .where(eq(quizVersions.quizVersionId, quizVersionId))
          .limit(1);

        if (qv) {
          const scoreNum = parseFloat(attempt.scorePercent);

          const [existingStats] = await tx
            .select({
              totalAttempts: quizStats.totalAttempts,
              avgScorePercent: quizStats.avgScorePercent,
            })
            .from(quizStats)
            .where(eq(quizStats.quizId, qv.quizId))
            .limit(1);

          if (existingStats) {
            const oldAvg = parseFloat((existingStats.avgScorePercent as string) ?? '0');
            const n = Number(existingStats.totalAttempts);
            const newAvg = oldAvg + (scoreNum - oldAvg) / (n + 1);

            await tx
              .update(quizStats)
              .set({
                totalAttempts: n + 1,
                avgScorePercent: newAvg.toFixed(2),
                lastAttemptAt: finishedAt ?? ctx.nowIso,
                updatedAt: ctx.nowIso,
              })
              .where(eq(quizStats.quizId, qv.quizId));
          } else {
            await tx.insert(quizStats).values({
              quizId: qv.quizId,
              totalAttempts: 1,
              totalPlayers: 1,
              avgScorePercent: attempt.scorePercent,
              lastAttemptAt: finishedAt ?? ctx.nowIso,
              updatedAt: ctx.nowIso,
            });
          }
        }
      }

      inserted++;
      logger.info(`Created attempt ${attempt.attemptId} (${attempt.status}) for ${attempt.userUsername} on ${attempt.quizSlug}`);
    }

    summaries.push({ domain: 'attempts', inserted, updated: 0, skipped });
  });

  return summaries;
};
