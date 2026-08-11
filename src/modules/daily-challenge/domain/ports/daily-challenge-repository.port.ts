/**
 * Phase 3 (S-14): repository port for the daily-challenge module.
 *
 * Owns the table-level CRUD for `daily_challenge` and
 * `daily_challenge_attempt`. The Drizzle implementation lives in
 * `infrastructure/repositories/daily-challenge.repository.ts`.
 */

import type {
  DailyChallengeAttemptRow,
  DailyChallengeHistoryCursor,
  DailyChallengeRow,
} from '../types/daily-challenge.types';

export type { DailyChallengeAttemptRow, DailyChallengeHistoryCursor, DailyChallengeRow };

export const DAILY_CHALLENGE_REPOSITORY_PORT = Symbol('DAILY_CHALLENGE_REPOSITORY_PORT');

export interface DailyChallengeRepositoryPort {
  /**
   * Find the challenge for `date` (UTC midnight). Returns `null`
   * when the cron has not yet rotated the day — the application
   * service surfaces a 404 in that case.
   */
  findByDate(date: string): Promise<DailyChallengeRow | null>;

  /**
   * Find the most-recent challenge whose `expires_at <= now`,
   * used by the public `GET /daily-challenge/today` route to
   * render an `'expired'` snapshot when the cron is between
   * rotations.
   */
  findMostRecentExpired(nowIso: string): Promise<DailyChallengeRow | null>;

  /**
   * The user's attempt for `challengeId`, or `null` when the
   * user has not yet started. The application layer composes
   * this with `findByDate` to render the `status` discriminator.
   */
  findAttempt(challengeId: string, userId: string): Promise<DailyChallengeAttemptRow | null>;

  /**
   * Cursor-paginated history for the viewer. Rows are newest
   * first.
   */
  listUserHistory(params: {
    userId: string;
    cursor?: DailyChallengeHistoryCursor | null;
    limit: number;
  }): Promise<{
    items: DailyChallengeRow[];
    hasNextPage: boolean;
  }>;

  /**
   * Phase 3 (S-14): leaderboard aggregation. Counts distinct
   * attempts per period and ranks by `score_percent DESC,
   * completed_at ASC` (the faster finisher wins ties). The
   * period discriminator is honoured at the SQL layer.
   */
  getLeaderboard(params: { period: 'daily' | 'weekly' | 'monthly'; limit: number }): Promise<
    Array<{
      userId: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      scorePercent: number;
    }>
  >;

  /**
   * Phase 3 (S-14): rank projection for a single user within
   * the leaderboard. Returns `null` when the user has no
   * qualifying attempt in the period.
   */
  getUserRank(params: {
    userId: string;
    period: 'daily' | 'weekly' | 'monthly';
  }): Promise<number | null>;

  /**
   * Cron rotation entry point. Picks a quiz from the
   * trending/featured pool and inserts a fresh row for `date`.
   */
  insertDailyChallenge(params: {
    challengeDate: string;
    quizId: string;
    quizVersionId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    rewardXp: number;
    expiresAt: string;
    createdAt: string;
  }): Promise<{ challengeId: string }>;

  /**
   * Inserts or updates an in-flight attempt. The application
   * service uses `INSERT ... ON CONFLICT DO UPDATE` to keep the
   * row append-only on first submission; subsequent submissions
   * mutate `answers`, `next_question_index`, and (when
   * completing) `score_percent` + `completed_at`.
   */
  upsertAttempt(params: {
    challengeId: string;
    userId: string;
    answers: string[];
    nextQuestionIndex: number;
    totalQuestions: number | null;
    scorePercent: string | null;
    completedAt: string | null;
    nowIso: string;
  }): Promise<DailyChallengeAttemptRow>;
}
