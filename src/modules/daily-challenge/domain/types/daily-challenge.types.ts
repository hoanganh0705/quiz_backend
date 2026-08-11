/**
 * Phase 3 (S-14): domain types for the daily-challenge module.
 *
 * `DailyChallengeStatus` mirrors the public DTO's discriminator
 * (see `daily-challenge-response.dto.ts`). The two enums together
 * (status + difficulty) cover all branching surfaces.
 */
export type DailyChallengeStatus = 'pending' | 'completed' | 'expired';

export type DailyChallengeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Internal row shape for `dailyChallenge`. The `totalQuestions`
 * field is denormalised at write time (the cron copies the
 * published version's question count) so the public DTO does
 * not need a per-row aggregation at read time.
 */
export type DailyChallengeRow = {
  challengeId: string;
  challengeDate: string;
  quizId: string;
  quizVersionId: string;
  rewardXp: number;
  createdAt: string;
  expiresAt: string;
  totalQuestions?: number;
  quizTitle?: string;
  quizSlug?: string;
  difficulty?: DailyChallengeDifficulty;
};

export type DailyChallengeAttemptRow = {
  attemptId: string;
  challengeId: string;
  userId: string;
  answers: string[];
  nextQuestionIndex: number;
  totalQuestions: number | null;
  scorePercent: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * History cursor shape — opaque to clients. The application
 * service encodes/decodes via `Base64Url(JSON.stringify(...))`
 * so the cursor survives round-trips through query strings.
 */
export type DailyChallengeHistoryCursor = {
  challengeDate: string;
  challengeId: string;
};
