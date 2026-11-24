import { and, eq, sql } from 'drizzle-orm';
import { db, type SeedContext } from '../infrastructure';
import { SeedLookup } from '../shared/seed-lookup';
import {
  quizzes,
  quizVersions,
  quizQuestions,
  quizAnswerOptions,
  quizAttempts,
  quizAttemptAnswers,
  quizStats,
} from '@/core/database/schema';
import { logger } from '../infrastructure/seed-logger';
import type { SeedSummary } from '../infrastructure/types';

interface AttemptSeedConfig {
  username: string;
  quizSlug: string;
  scorePercent: number;
  status: 'completed' | 'started';
  daysAgo: number;
  durationMs: number;
}

const ATTEMPT_SEEDS: AttemptSeedConfig[] = [
  // learner_user history (realistic mix of pass/fail/in-progress)
  {
    username: 'learner_user',
    quizSlug: 'javascript-fundamentals',
    scorePercent: 80,
    status: 'completed',
    daysAgo: 3,
    durationMs: 140_000,
  },
  {
    username: 'learner_user',
    quizSlug: 'world-history-chronicles',
    scorePercent: 100,
    status: 'completed',
    daysAgo: 2,
    durationMs: 180_000,
  },
  {
    username: 'learner_user',
    quizSlug: 'algorithms-advanced',
    scorePercent: 33.33,
    status: 'completed',
    daysAgo: 1,
    durationMs: 240_000,
  },
  {
    username: 'learner_user',
    quizSlug: 'modern-science-wonders',
    scorePercent: 80,
    status: 'completed',
    daysAgo: 1,
    durationMs: 160_000,
  },
  {
    username: 'learner_user',
    quizSlug: 'system-design-v2',
    scorePercent: 0,
    status: 'started',
    daysAgo: 0,
    durationMs: 45_000,
  },

  // power_user history (flawless master)
  {
    username: 'power_user',
    quizSlug: 'javascript-fundamentals',
    scorePercent: 100,
    status: 'completed',
    daysAgo: 5,
    durationMs: 85_000,
  },
  {
    username: 'power_user',
    quizSlug: 'system-design-v2',
    scorePercent: 100,
    status: 'completed',
    daysAgo: 4,
    durationMs: 120_000,
  },
  {
    username: 'power_user',
    quizSlug: 'algorithms-advanced',
    scorePercent: 100,
    status: 'completed',
    daysAgo: 3,
    durationMs: 110_000,
  },
  {
    username: 'power_user',
    quizSlug: 'world-history-chronicles',
    scorePercent: 100,
    status: 'completed',
    daysAgo: 2,
    durationMs: 95_000,
  },
  {
    username: 'power_user',
    quizSlug: 'world-geography-explorer',
    scorePercent: 100,
    status: 'completed',
    daysAgo: 1,
    durationMs: 90_000,
  },
];

export const runAttemptSeed = async (): Promise<SeedSummary[]> => {
  const now = Date.now();
  let insertedAttempts = 0;
  let insertedAnswers = 0;

  await db.transaction(async (tx) => {
    const lookup = new SeedLookup(tx);
    const affectedQuizIds = new Set<string>();

    for (const config of ATTEMPT_SEEDS) {
      const userId = await lookup.userIdByUsername(config.username);
      const quizId = await lookup.quizIdBySlug(config.quizSlug);
      const quizVersionId = await lookup.publishedVersionIdByQuizSlug(config.quizSlug);

      if (!quizId || !quizVersionId) {
        logger.warn(`Attempt seed: quiz "${config.quizSlug}" published version not found.`);
        continue;
      }

      affectedQuizIds.add(quizId);

      // Get questions for this version
      const questions = await tx
        .select({
          questionId: quizQuestions.questionId,
          position: quizQuestions.position,
        })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizVersionId, quizVersionId))
        .orderBy(quizQuestions.position);

      if (questions.length === 0) continue;

      const totalQuestions = questions.length;
      const targetCorrectCount =
        config.status === 'completed'
          ? Math.round((config.scorePercent / 100) * totalQuestions)
          : 0;

      const startedAt = new Date(
        now - config.daysAgo * 86_400_000 - config.durationMs,
      ).toISOString();
      const finishedAt =
        config.status === 'completed'
          ? new Date(now - config.daysAgo * 86_400_000).toISOString()
          : null;

      const [attempt] = await tx
        .insert(quizAttempts)
        .values({
          userId,
          quizVersionId,
          contextType: 'solo',
          status: config.status,
          scorePercent:
            config.status === 'completed' ? String(config.scorePercent) : null,
          correctCount: config.status === 'completed' ? targetCorrectCount : null,
          startedAt,
          finishedAt,
          timeTakenMs: config.durationMs,
          xpEarned:
            config.status === 'completed'
              ? Math.round(config.scorePercent)
              : 0,
          createdAt: startedAt,
          updatedAt: finishedAt ?? startedAt,
        })
        .returning({ attemptId: quizAttempts.attemptId });

      insertedAttempts++;

      // Populate answers
      const numQuestionsToAnswer =
        config.status === 'completed'
          ? totalQuestions
          : Math.min(2, totalQuestions);

      let correctAssigned = 0;

      for (let i = 0; i < numQuestionsToAnswer; i++) {
        const q = questions[i];
        const options = await tx
          .select({
            optionId: quizAnswerOptions.optionId,
            isCorrect: quizAnswerOptions.isCorrect,
          })
          .from(quizAnswerOptions)
          .where(eq(quizAnswerOptions.questionId, q.questionId));

        if (options.length === 0) continue;

        let selectedOptionId: string | null = null;
        if (correctAssigned < targetCorrectCount) {
          const correctOpt = options.find((o) => o.isCorrect);
          selectedOptionId = correctOpt ? correctOpt.optionId : options[0].optionId;
          correctAssigned++;
        } else {
          const wrongOpt = options.find((o) => !o.isCorrect);
          selectedOptionId = wrongOpt ? wrongOpt.optionId : options[0].optionId;
        }

        const answerTime = new Date(
          new Date(startedAt).getTime() + (i + 1) * 20_000,
        ).toISOString();

        await tx.insert(quizAttemptAnswers).values({
          attemptId: attempt.attemptId,
          questionId: q.questionId,
          selectedOptionId,
          answeredAt: answerTime,
          timeTakenMs: 20_000,
        });

        insertedAnswers++;
      }
    }

    // Update quiz_stats for each affected quiz
    for (const quizId of affectedQuizIds) {
      await tx
        .insert(quizStats)
        .values({
          quizId,
          totalAttempts: 5,
          totalPlayers: 3,
          avgScorePercent: '85.50',
          avgRating: '4.80',
          ratingCount: 3,
          bookmarkCount: 2,
          completionRate: '92.00',
          popularityScore: '78.5000',
          trendingScore: '88.0000',
          lastAttemptAt: new Date().toISOString(),
          lastCalculatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: quizStats.quizId,
          set: {
            totalAttempts: 5,
            totalPlayers: 3,
            avgScorePercent: '85.50',
            completionRate: '92.00',
            lastAttemptAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
    }

    logger.info(
      `Seeded quiz attempts (attempts: ${insertedAttempts}, answers: ${insertedAnswers})`,
    );
  });

  return [
    { domain: 'quiz_attempts', inserted: insertedAttempts, updated: 0, skipped: 0 },
    { domain: 'quiz_attempt_answers', inserted: insertedAnswers, updated: 0, skipped: 0 },
  ];
};
