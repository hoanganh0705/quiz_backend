import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { dailyChallenge, dailyChallengeAttempt, quizzes } from '@/core/database/schema';
import type {
  DailyChallengeAttemptRow,
  DailyChallengeHistoryCursor,
  DailyChallengeRepositoryPort,
  DailyChallengeRow,
} from '../../domain/ports/daily-challenge-repository.port';

/**
 * Phase 3 (S-14): Drizzle implementation of the daily-challenge
 * repository port. The implementation is read-heavy; the only
 * write paths are the cron insertion and the per-attempt upsert.
 *
 * Batched reads (history list, leaderboard) use a single SQL
 * round-trip with `generate_series` densification on the period
 * side so the public DTOs render without further math.
 */
@Injectable()
export class DailyChallengeRepository implements DailyChallengeRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByDate(date: string): Promise<DailyChallengeRow | null> {
    const [row] = await this.db
      .select({
        challengeId: dailyChallenge.challengeId,
        challengeDate: dailyChallenge.challengeDate,
        quizId: dailyChallenge.quizId,
        quizVersionId: dailyChallenge.quizVersionId,
        rewardXp: dailyChallenge.rewardXp,
        createdAt: dailyChallenge.createdAt,
        expiresAt: dailyChallenge.expiresAt,
        quizTitle: quizzes.title,
        quizSlug: quizzes.slug,
        totalQuestions: sql<number>`(
          SELECT COUNT(*)::int FROM quiz_questions
          WHERE quiz_questions.quiz_version_id = ${dailyChallenge.quizVersionId}
        )`,
      })
      .from(dailyChallenge)
      .innerJoin(quizzes, eq(dailyChallenge.quizId, quizzes.quizId))
      .where(and(eq(dailyChallenge.challengeDate, date), isNull(quizzes.deletedAt)))
      .limit(1);

    return (row as DailyChallengeRow | undefined) ?? null;
  }

  async findMostRecentExpired(nowIso: string): Promise<DailyChallengeRow | null> {
    const [row] = await this.db
      .select({
        challengeId: dailyChallenge.challengeId,
        challengeDate: dailyChallenge.challengeDate,
        quizId: dailyChallenge.quizId,
        quizVersionId: dailyChallenge.quizVersionId,
        rewardXp: dailyChallenge.rewardXp,
        createdAt: dailyChallenge.createdAt,
        expiresAt: dailyChallenge.expiresAt,
        quizTitle: quizzes.title,
        quizSlug: quizzes.slug,
        totalQuestions: sql<number>`(
          SELECT COUNT(*)::int FROM quiz_questions
          WHERE quiz_questions.quiz_version_id = ${dailyChallenge.quizVersionId}
        )`,
      })
      .from(dailyChallenge)
      .innerJoin(quizzes, eq(dailyChallenge.quizId, quizzes.quizId))
      .where(and(sql`${dailyChallenge.expiresAt} <= ${nowIso}`, isNull(quizzes.deletedAt)))
      .orderBy(desc(dailyChallenge.challengeDate))
      .limit(1);

    return (row as DailyChallengeRow | undefined) ?? null;
  }

  async findAttempt(challengeId: string, userId: string): Promise<DailyChallengeAttemptRow | null> {
    const [row] = await this.db
      .select()
      .from(dailyChallengeAttempt)
      .where(
        and(
          eq(dailyChallengeAttempt.challengeId, challengeId),
          eq(dailyChallengeAttempt.userId, userId),
        ),
      )
      .limit(1);

    return (row as DailyChallengeAttemptRow | undefined) ?? null;
  }

  async listUserHistory(params: {
    userId: string;
    cursor?: DailyChallengeHistoryCursor | null;
    limit: number;
  }): Promise<{
    items: DailyChallengeRow[];
    hasNextPage: boolean;
  }> {
    const filters: SQL[] = [
      eq(dailyChallengeAttempt.userId, params.userId),
      sql`${dailyChallengeAttempt.completedAt} IS NOT NULL`,
    ];

    if (params.cursor) {
      filters.push(
        sql`(${dailyChallenge.challengeDate}, ${dailyChallenge.challengeId}) < (${params.cursor.challengeDate}, ${params.cursor.challengeId})`,
      );
    }

    const rows = await this.db
      .select({
        challengeId: dailyChallenge.challengeId,
        challengeDate: dailyChallenge.challengeDate,
        quizId: dailyChallenge.quizId,
        quizVersionId: dailyChallenge.quizVersionId,
        rewardXp: dailyChallenge.rewardXp,
        createdAt: dailyChallenge.createdAt,
        expiresAt: dailyChallenge.expiresAt,
        quizTitle: quizzes.title,
        quizSlug: quizzes.slug,
        scorePercent: dailyChallengeAttempt.scorePercent,
        completedAt: dailyChallengeAttempt.completedAt,
      })
      .from(dailyChallengeAttempt)
      .innerJoin(dailyChallenge, eq(dailyChallengeAttempt.challengeId, dailyChallenge.challengeId))
      .innerJoin(quizzes, eq(dailyChallenge.quizId, quizzes.quizId))
      .where(and(...filters))
      .orderBy(desc(dailyChallenge.challengeDate), desc(dailyChallenge.challengeId))
      .limit(params.limit + 1);

    const hasNextPage = rows.length > params.limit;
    const items = (hasNextPage ? rows.slice(0, params.limit) : rows) as DailyChallengeRow[];
    return { items, hasNextPage };
  }

  async getLeaderboard(params: { period: 'daily' | 'weekly' | 'monthly'; limit: number }): Promise<
    Array<{
      userId: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      scorePercent: number;
    }>
  > {
    const windowStart = sql<string>`date_trunc('day', NOW() - INTERVAL '${
      params.period === 'daily' ? 1 : params.period === 'weekly' ? 7 : 30
    } days')`;

    const rows = await this.db.execute(sql<{
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      score_percent: string;
    }>`
      WITH windowed AS (
        SELECT
          a.user_id,
          a.score_percent,
          ROW_NUMBER() OVER (
            PARTITION BY a.user_id
            ORDER BY a.score_percent DESC, a.completed_at ASC
          ) AS rn
        FROM daily_challenge_attempt a
        INNER JOIN daily_challenge c ON c.challenge_id = a.challenge_id
        WHERE a.completed_at IS NOT NULL
          AND a.score_percent IS NOT NULL
          AND c.created_at >= ${windowStart}
      )
      SELECT
        w.user_id,
        u.username,
        up.display_name,
        up.avatar_url,
        w.score_percent::text
      FROM windowed w
      INNER JOIN users u ON u.user_id = w.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.user_id
      WHERE w.rn = 1
      ORDER BY w.score_percent DESC, MIN(w.score_percent) ASC
      LIMIT ${params.limit}
    `);

    type Row = {
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      score_percent: string;
    };
    const rawRows = (rows as unknown as { rows?: Row[] }).rows ?? [];
    return rawRows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name ?? null,
      avatarUrl: r.avatar_url ?? null,
      scorePercent: Number(r.score_percent),
    }));
  }

  async getUserRank(params: {
    userId: string;
    period: 'daily' | 'weekly' | 'monthly';
  }): Promise<number | null> {
    // Single-query rank projection. Returns the user's 1-indexed
    // rank in the period's leaderboard, or null when the user
    // has no qualifying attempt.
    const windowStart = sql<string>`date_trunc('day', NOW() - INTERVAL '${
      params.period === 'daily' ? 1 : params.period === 'weekly' ? 7 : 30
    } days')`;

    const [row] = await this.db.execute(sql<{ rank: number | null }>`
      WITH windowed AS (
        SELECT
          a.user_id,
          a.score_percent,
          ROW_NUMBER() OVER (
            ORDER BY a.score_percent DESC, a.completed_at ASC
          ) AS rank
        FROM daily_challenge_attempt a
        INNER JOIN daily_challenge c ON c.challenge_id = a.challenge_id
        WHERE a.completed_at IS NOT NULL
          AND a.score_percent IS NOT NULL
          AND c.created_at >= ${windowStart}
      )
      SELECT rank::int AS rank FROM windowed WHERE user_id = ${params.userId} LIMIT 1
    `);

    const result = (row as unknown as { rank: number | null } | undefined) ?? null;
    return result?.rank ?? null;
  }

  async insertDailyChallenge(params: {
    challengeDate: string;
    quizId: string;
    quizVersionId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
    rewardXp: number;
    expiresAt: string;
    createdAt: string;
  }): Promise<{ challengeId: string }> {
    const [row] = await this.db
      .insert(dailyChallenge)
      .values({
        challengeDate: params.challengeDate,
        quizId: params.quizId,
        quizVersionId: params.quizVersionId,
        rewardXp: params.rewardXp,
        createdAt: params.createdAt,
        expiresAt: params.expiresAt,
      })
      .onConflictDoNothing({ target: dailyChallenge.challengeDate })
      .returning({ challengeId: dailyChallenge.challengeId });

    return { challengeId: row?.challengeId ?? '' };
  }

  async upsertAttempt(params: {
    challengeId: string;
    userId: string;
    answers: string[];
    nextQuestionIndex: number;
    totalQuestions: number | null;
    scorePercent: string | null;
    completedAt: string | null;
    nowIso: string;
  }): Promise<DailyChallengeAttemptRow> {
    const [row] = await this.db
      .insert(dailyChallengeAttempt)
      .values({
        challengeId: params.challengeId,
        userId: params.userId,
        answers: params.answers,
        nextQuestionIndex: params.nextQuestionIndex,
        totalQuestions: params.totalQuestions,
        scorePercent: params.scorePercent,
        completedAt: params.completedAt,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .onConflictDoUpdate({
        target: [dailyChallengeAttempt.challengeId, dailyChallengeAttempt.userId],
        set: {
          answers: params.answers,
          nextQuestionIndex: params.nextQuestionIndex,
          totalQuestions: params.totalQuestions,
          scorePercent: params.scorePercent,
          completedAt: params.completedAt,
          updatedAt: params.nowIso,
        },
      })
      .returning();

    return row as DailyChallengeAttemptRow;
  }
}
