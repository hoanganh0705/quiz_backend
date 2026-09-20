export type DailyChallengeStatus = 'pending' | 'completed' | 'expired';

export type DailyChallengeDifficulty = 'easy' | 'medium' | 'hard';

export type DailyChallengePeriod = 'daily' | 'weekly' | 'monthly';

export const SKIPPED_ANSWER_SENTINEL = '__skipped__';

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
  scorePercent?: string | null;
  completedAt?: string | null;
  rank?: number | null;
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

export type DailyChallengeHistoryCursor = {
  challengeDate: string;
  challengeId: string;
};

export type DailyChallengeHistoryItem = {
  challengeId: string;
  challengeDate: string;
  quizId: string;
  quizTitle: string | null;
  quizSlug: string | null;
  difficulty: DailyChallengeDifficulty | null;
  scorePercent: string | null;
  completedAt: string | null;
};

export type DailyChallengeCategoryBreakdownRow = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  attemptCount: number;
  averageScorePercent: number;
};

export type DailyChallengeLeaderboardEntry = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  scorePercent: number;
};
