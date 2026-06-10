import type { AttemptDetailRow, AttemptAnswerRow } from './ports/attempt-repository.port';

function calculateScorePercent(correctCount: number, totalAnswers: number): string {
  if (totalAnswers === 0) return '0.00';
  return ((correctCount / totalAnswers) * 100).toFixed(2);
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
   * Calculates the score percentage from correct count and total answers.
   */
  calculateScorePercent,

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
};
