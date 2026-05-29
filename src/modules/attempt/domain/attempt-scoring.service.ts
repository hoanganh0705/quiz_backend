import type { AttemptDetailRow, AttemptAnswerRow } from './ports/attempt-repository.port';

function calculateScore(answers: AttemptAnswerRow[]): {
  correctCount: number;
  scorePercent: string;
} {
  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const totalQuestions = answers.length;

  const scorePercent =
    totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : '0.00';

  return { correctCount, scorePercent };
}

function calculateTimeTakenMs(startedAt: string, nowIso: string): number {
  if (!startedAt) {
    return 0;
  }

  return new Date(nowIso).getTime() - new Date(startedAt).getTime();
}

function calculateXpEarned(
  scorePercent: string,
  passingScorePercent: number,
  rewardXp: number,
): number {
  const scoreNum = parseFloat(scorePercent);
  return scoreNum >= passingScorePercent ? rewardXp : 0;
}

/**
 * AttemptScoringService — Pure scoring and XP calculation logic.
 *
 * No side effects. No database access. No DI dependencies.
 */
export const AttemptScoringService = {
  /**
   * Calculates the score from submitted answers.
   */
  calculateScore,

  /**
   * Calculates elapsed time from start timestamp to completion timestamp.
   * Uses the nowIso timestamp (the completion time) rather than a pre-fetched finishedAt
   * which would be null before persistence.
   */
  calculateTimeTakenMs,

  /**
   * Calculates XP earned based on passing score.
   */
  calculateXpEarned,

  /**
   * Calculates all scoring metrics from attempt data.
   */
  computeScoringResult(
    attempt: AttemptDetailRow,
    answers: AttemptAnswerRow[],
    nowIso: string,
  ): {
    correctCount: number;
    scorePercent: string;
    timeTakenMs: number;
    xpEarned: number;
  } {
    const { correctCount, scorePercent } = calculateScore(answers);
    const timeTakenMs = calculateTimeTakenMs(attempt.startedAt, nowIso);
    const xpEarned = calculateXpEarned(scorePercent, attempt.passingScorePercent, attempt.rewardXp);

    return { correctCount, scorePercent, timeTakenMs, xpEarned };
  },
};
