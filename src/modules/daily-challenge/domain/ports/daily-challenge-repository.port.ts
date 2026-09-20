import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from '@/core/database/schema';
import type {
  DailyChallengeAttemptRow,
  DailyChallengeCategoryBreakdownRow,
  DailyChallengeHistoryCursor,
  DailyChallengeHistoryItem,
  DailyChallengeLeaderboardEntry,
  DailyChallengePeriod,
  DailyChallengeRow,
} from '../types/daily-challenge.types';

export type {
  DailyChallengeAttemptRow,
  DailyChallengeCategoryBreakdownRow,
  DailyChallengeHistoryCursor,
  DailyChallengeHistoryItem,
  DailyChallengeLeaderboardEntry,
  DailyChallengePeriod,
  DailyChallengeRow,
};

export type DailyChallengeTx = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export const DAILY_CHALLENGE_REPOSITORY_PORT = Symbol('DAILY_CHALLENGE_REPOSITORY_PORT');

export interface DailyChallengeRepositoryPort {
  findByDate(date: string): Promise<DailyChallengeRow | null>;
  findMostRecentExpired(nowIso: string): Promise<DailyChallengeRow | null>;
  findAttempt(challengeId: string, userId: string): Promise<DailyChallengeAttemptRow | null>;
  listUserHistory(params: {
    userId: string;
    cursor?: DailyChallengeHistoryCursor | null;
    limit: number;
  }): Promise<{
    items: DailyChallengeHistoryItem[];
    hasNextPage: boolean;
  }>;
  getLeaderboard(params: {
    period: DailyChallengePeriod;
    limit: number;
  }): Promise<DailyChallengeLeaderboardEntry[]>;
  getUserRank(params: { userId: string; period: DailyChallengePeriod }): Promise<number | null>;
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
  getCategoryBreakdown(userId: string): Promise<DailyChallengeCategoryBreakdownRow[]>;
  runInTransaction<T>(
    work: (
      tx: DailyChallengeTx,
      helpers: {
        lockAttemptForUpdate(params: {
          challengeId: string;
          userId: string;
        }): Promise<DailyChallengeAttemptRow | null>;
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
      },
    ) => Promise<T>,
  ): Promise<T>;
}
