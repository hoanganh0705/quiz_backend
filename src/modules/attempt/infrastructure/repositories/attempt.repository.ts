import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  quizAttempts,
  quizAnswerOptions,
  quizQuestions,
  quizVersions,
  quizzes,
  quizAttemptAnswers,
  quizStats,
  quizCategories,
  categories,
  quizTags,
  tags,
  users,
} from '@/core/database/schema';
import type { AttemptContextType } from '@/modules/attempt/types/attempt.types';
import type { AttemptListCursorPayload, AttemptListSortField } from '@/modules/attempt/mappers/attempt-cursor.mapper';
import type {
  AttemptRow,
  AttemptDetailRow,
  AttemptListRow,
  AttemptAnswerRow,
  AttemptAnalyticsRow,
  UserAttemptStatsRow,
  AttemptRepositoryPort,
} from '@/modules/attempt/domain/ports';

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  title: AnyPgColumn;
  slug: AnyPgColumn;
  creatorId: AnyPgColumn;
  deletedAt: AnyPgColumn;
};

const QUIZ_VERSION_COLUMNS = quizVersions as unknown as {
  quizVersionId: AnyPgColumn;
  quizId: AnyPgColumn;
  versionNumber: AnyPgColumn;
  difficulty: AnyPgColumn;
  durationMs: AnyPgColumn;
  passingScorePercent: AnyPgColumn;
  rewardXp: AnyPgColumn;
};

const QUIZ_ATTEMPT_COLUMNS = quizAttempts as unknown as {
  attemptId: AnyPgColumn;
  quizVersionId: AnyPgColumn;
  userId: AnyPgColumn;
  status: AnyPgColumn;
  startedAt: AnyPgColumn;
};

const ATTEMPT_LIST_DEFAULT_SORT: AttemptListSortField = 'createdAt';

@Injectable()
export class AttemptRepository implements AttemptRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getAttemptById(attemptId: string): Promise<AttemptRow | null> {
    const [row] = await this.db
      .select({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.attemptId, attemptId))
      .limit(1);

    return (row as AttemptRow | undefined) ?? null;
  }

  async getAttemptDetailById(attemptId: string): Promise<AttemptDetailRow | null> {
    const [row] = await this.db
      .select({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
        quizId: QUIZ_COLUMNS.quizId,
        quizTitle: QUIZ_COLUMNS.title,
        quizSlug: QUIZ_COLUMNS.slug,
        quizCreatorId: QUIZ_COLUMNS.creatorId,
        versionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
        difficulty: QUIZ_VERSION_COLUMNS.difficulty,
        durationMs: QUIZ_VERSION_COLUMNS.durationMs,
        passingScorePercent: QUIZ_VERSION_COLUMNS.passingScorePercent,
        rewardXp: QUIZ_VERSION_COLUMNS.rewardXp,
      })
      .from(quizAttempts)
      .innerJoin(
        quizVersions,
        eq(QUIZ_ATTEMPT_COLUMNS.quizVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .innerJoin(quizzes, eq(QUIZ_VERSION_COLUMNS.quizId, QUIZ_COLUMNS.quizId))
      .where(and(eq(QUIZ_ATTEMPT_COLUMNS.attemptId, attemptId), isNull(QUIZ_COLUMNS.deletedAt)))
      .limit(1);

    return (row as AttemptDetailRow | undefined) ?? null;
  }

  async getActiveAttemptByUserAndVersion(
    userId: string,
    quizVersionId: string,
  ): Promise<AttemptRow | null> {
    const [row] = await this.db
      .select({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.quizVersionId, quizVersionId),
          eq(quizAttempts.status, 'started'),
        ),
      )
      .limit(1);

    return (row as AttemptRow | undefined) ?? null;
  }

  async listAttemptsByUser(params: {
    userId: string;
    limit: number;
    cursor?: AttemptListCursorPayload | null;
    status?: 'started' | 'completed' | 'abandoned';
    quizId?: string;
    categoryId?: string;
    tagId?: string;
    fromDate?: string;
    toDate?: string;
    sortBy: AttemptListSortField;
  }): Promise<AttemptListRow[]> {
    const sortBy = params.sortBy ?? ATTEMPT_LIST_DEFAULT_SORT;

    const sortColumn =
      sortBy === 'completedAt'
        ? quizAttempts.finishedAt
        : sortBy === 'score'
          ? quizAttempts.scorePercent
          : quizAttempts.createdAt;

    const cursorCondition = params.cursor
      ? sortBy === 'score'
        ? or(
            sql`${sortColumn}::numeric < ${params.cursor.sortValue as number}`,
            and(
              sql`${sortColumn}::numeric = ${params.cursor.sortValue as number}`,
              sql`${quizAttempts.attemptId} < ${params.cursor.attemptId}`,
            ),
          )
        : params.cursor.sortValue === null
          ? sql`false`
          : or(
              sql`${sortColumn} < ${params.cursor.sortValue as string}`,
              and(
                eq(sortColumn, params.cursor.sortValue as string),
                sql`${quizAttempts.attemptId} < ${params.cursor.attemptId}`,
              ),
            )
      : undefined;

    const filters: SQL[] = [eq(quizAttempts.userId, params.userId), isNull(QUIZ_COLUMNS.deletedAt)];

    if (params.status) {
      filters.push(eq(quizAttempts.status, params.status));
    }

    if (params.quizId) {
      filters.push(eq(QUIZ_COLUMNS.quizId, params.quizId));
    }

    if (params.categoryId) {
      filters.push(
        sql`EXISTS (
          SELECT 1
          FROM quiz_categories qc
          WHERE qc.quiz_id = ${QUIZ_COLUMNS.quizId}
            AND qc.category_id = ${params.categoryId}
        )`,
      );
    }

    if (params.tagId) {
      filters.push(
        sql`EXISTS (
          SELECT 1
          FROM quiz_tags qt
          WHERE qt.quiz_id = ${QUIZ_COLUMNS.quizId}
            AND qt.tag_id = ${params.tagId}
        )`,
      );
    }

    if (params.fromDate) {
      filters.push(sql`${quizAttempts.createdAt} >= ${params.fromDate}`);
    }

    if (params.toDate) {
      filters.push(sql`${quizAttempts.createdAt} <= ${params.toDate}`);
    }

    if (cursorCondition) {
      filters.push(cursorCondition);
    }

    const rows = await this.db
      .select({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
        quizId: QUIZ_COLUMNS.quizId,
        quizTitle: QUIZ_COLUMNS.title,
        quizSlug: QUIZ_COLUMNS.slug,
        versionNumber: QUIZ_VERSION_COLUMNS.versionNumber,
        difficulty: QUIZ_VERSION_COLUMNS.difficulty,
        sortCompletedAt: quizAttempts.finishedAt,
        sortCreatedAt: quizAttempts.createdAt,
        sortScore: sql<number | null>`${quizAttempts.scorePercent}::numeric`,
      })
      .from(quizAttempts)
      .innerJoin(
        quizVersions,
        eq(QUIZ_ATTEMPT_COLUMNS.quizVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .innerJoin(quizzes, eq(QUIZ_VERSION_COLUMNS.quizId, QUIZ_COLUMNS.quizId))
      .where(and(...filters))
      .orderBy(desc(sortColumn), desc(quizAttempts.attemptId))
      .limit(params.limit + 1);

    return rows as AttemptListRow[];
  }

  async createAttempt(params: {
    userId: string;
    quizVersionId: string;
    contextType: AttemptContextType;
    contextRefId: string | null;
    nowIso: string;
  }): Promise<AttemptRow> {
    const [created] = await this.db
      .insert(quizAttempts)
      .values({
        userId: params.userId,
        quizVersionId: params.quizVersionId,
        contextType: params.contextType,
        contextRefId: params.contextRefId,
        status: 'started',
        startedAt: params.nowIso,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
      });

    return created as AttemptRow;
  }

  async abandonAttempt(params: {
    attemptId: string;
    userId: string;
    nowIso: string;
  }): Promise<AttemptRow> {
    const [updated] = await this.db
      .update(quizAttempts)
      .set({
        status: 'abandoned',
        finishedAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .where(
        and(
          eq(quizAttempts.attemptId, params.attemptId),
          eq(quizAttempts.userId, params.userId),
          eq(quizAttempts.status, 'started'),
        ),
      )
      .returning({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
      });

    return updated as AttemptRow;
  }

  async getAttemptAnswersByAttemptId(attemptId: string): Promise<AttemptAnswerRow[]> {
    const rows = await this.db
      .select({
        attemptAnswerId: quizAttemptAnswers.attemptAnswerId,
        attemptId: quizAttemptAnswers.attemptId,
        questionId: quizAttemptAnswers.questionId,
        selectedOptionId: quizAttemptAnswers.selectedOptionId,
        answeredAt: quizAttemptAnswers.answeredAt,
        timeTakenMs: quizAttemptAnswers.timeTakenMs,
        optionPosition: quizAnswerOptions.position,
        optionValue: quizAnswerOptions.value,
        isCorrect: quizAnswerOptions.isCorrect,
      })
      .from(quizAttemptAnswers)
      .leftJoin(
        quizAnswerOptions,
        eq(quizAttemptAnswers.selectedOptionId, quizAnswerOptions.optionId),
      )
      .where(eq(quizAttemptAnswers.attemptId, attemptId))
      .orderBy(quizAttemptAnswers.answeredAt);

    return rows as AttemptAnswerRow[];
  }

  async submitAnswer(params: {
    attemptId: string;
    userId: string;
    questionId: string;
    selectedOptionId: string | null;
    nowIso: string;
    timeTakenMs?: number | null;
  }): Promise<AttemptAnswerRow> {
    const [created] = await this.db
      .insert(quizAttemptAnswers)
      .values({
        attemptId: params.attemptId,
        questionId: params.questionId,
        selectedOptionId: params.selectedOptionId,
        answeredAt: params.nowIso,
        timeTakenMs: params.timeTakenMs ?? null,
      })
      .returning({
        attemptAnswerId: quizAttemptAnswers.attemptAnswerId,
        attemptId: quizAttemptAnswers.attemptId,
        questionId: quizAttemptAnswers.questionId,
        selectedOptionId: quizAttemptAnswers.selectedOptionId,
        answeredAt: quizAttemptAnswers.answeredAt,
        timeTakenMs: quizAttemptAnswers.timeTakenMs,
        optionPosition: quizAnswerOptions.position,
        optionValue: quizAnswerOptions.value,
        isCorrect: quizAnswerOptions.isCorrect,
      });

    return created as AttemptAnswerRow;
  }

  async checkAnswerOptionBelongsToQuestion(questionId: string, optionId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ optionId: quizAnswerOptions.optionId })
      .from(quizAnswerOptions)
      .where(
        and(eq(quizAnswerOptions.optionId, optionId), eq(quizAnswerOptions.questionId, questionId)),
      )
      .limit(1);

    return row !== undefined;
  }

  async countQuestionsByVersionId(quizVersionId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizVersionId, quizVersionId));

    return row?.count ?? 0;
  }

  async checkQuestionBelongsToVersion(questionId: string, quizVersionId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ questionId: quizQuestions.questionId })
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.questionId, questionId),
          eq(quizQuestions.quizVersionId, quizVersionId),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async completeAttemptAndSideEffects(params: {
    attemptId: string;
    scorePercent: string;
    correctCount: number;
    timeTakenMs: number;
    xpEarned: number;
    nowIso: string;
    quizId: string;
    userId: string;
  }): Promise<AttemptRow> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(quizAttempts)
        .set({
          status: 'completed',
          scorePercent: params.scorePercent,
          correctCount: params.correctCount,
          timeTakenMs: params.timeTakenMs,
          xpEarned: params.xpEarned,
          finishedAt: params.nowIso,
          updatedAt: params.nowIso,
        })
        .where(
          and(eq(quizAttempts.attemptId, params.attemptId), eq(quizAttempts.status, 'started')),
        )
        .returning({
          attemptId: quizAttempts.attemptId,
          userId: quizAttempts.userId,
          quizVersionId: quizAttempts.quizVersionId,
          contextType: quizAttempts.contextType,
          contextRefId: quizAttempts.contextRefId,
          status: quizAttempts.status,
          scorePercent: quizAttempts.scorePercent,
          correctCount: quizAttempts.correctCount,
          startedAt: quizAttempts.startedAt,
          finishedAt: quizAttempts.finishedAt,
          timeTakenMs: quizAttempts.timeTakenMs,
          xpEarned: quizAttempts.xpEarned,
          createdAt: quizAttempts.createdAt,
          updatedAt: quizAttempts.updatedAt,
        });

      if (!updated) {
        throw new Error('Failed to complete attempt - record not found or already completed');
      }

      const [statsRow] = await tx
        .select({
          totalAttempts: quizStats.totalAttempts,
          totalPlayers: quizStats.totalPlayers,
          avgScorePercent: quizStats.avgScorePercent,
        })
        .from(quizStats)
        .where(eq(quizStats.quizId, params.quizId))
        .limit(1);

      if (!statsRow) {
        await tx.insert(quizStats).values({
          quizId: params.quizId,
          totalAttempts: 1,
          totalPlayers: 1,
          avgScorePercent: params.scorePercent,
          lastAttemptAt: params.nowIso,
          updatedAt: params.nowIso,
        });
      } else {
        const newTotalAttempts = Number(statsRow.totalAttempts) + 1;
        const oldAvg = parseFloat(statsRow.avgScorePercent);
        const newScore = parseFloat(params.scorePercent);
        const newAvg = oldAvg + (newScore - oldAvg) / newTotalAttempts;

        await tx
          .update(quizStats)
          .set({
            totalAttempts: newTotalAttempts,
            avgScorePercent: newAvg.toFixed(2),
            lastAttemptAt: params.nowIso,
            updatedAt: params.nowIso,
          })
          .where(eq(quizStats.quizId, params.quizId));
      }

      if (params.xpEarned > 0) {
        await tx
          .update(users)
          .set({
            xpTotal: sql`${users.xpTotal} + ${params.xpEarned}`,
          })
          .where(eq(users.userId, params.userId));
      }

      return updated as AttemptRow;
    });
  }

  async createTournamentAttempt(params: {
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    roundId: string;
    nowIso: string;
  }): Promise<AttemptRow> {
    const [created] = await this.db
      .insert(quizAttempts)
      .values({
        userId: params.userId,
        quizVersionId: params.quizVersionId,
        contextType: 'tournament',
        contextRefId: params.tournamentId,
        status: 'started',
        startedAt: params.nowIso,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        attemptId: quizAttempts.attemptId,
        userId: quizAttempts.userId,
        quizVersionId: quizAttempts.quizVersionId,
        contextType: quizAttempts.contextType,
        contextRefId: quizAttempts.contextRefId,
        status: quizAttempts.status,
        scorePercent: quizAttempts.scorePercent,
        correctCount: quizAttempts.correctCount,
        startedAt: quizAttempts.startedAt,
        finishedAt: quizAttempts.finishedAt,
        timeTakenMs: quizAttempts.timeTakenMs,
        xpEarned: quizAttempts.xpEarned,
        createdAt: quizAttempts.createdAt,
        updatedAt: quizAttempts.updatedAt,
      });

    return created as AttemptRow;
  }

  /**
   * Returns analytics for a completed attempt.
   *
   * The percentile rank is computed via PERCENT_RANK() over all completed
   * attempts for the same quiz version, ordered by score ascending.
   * A rank of 0.75 means this attempt scored better than 75 % of peers.
   * totalQuestions is pulled from quiz_questions for the version.
   */
  async getAttemptAnalytics(attemptId: string): Promise<AttemptAnalyticsRow | null> {
    const [row] = await this.db.execute<{
      attempt_id: string;
      quiz_version_id: string;
      score_percent: string | null;
      correct_count: number | null;
      total_questions: number;
      time_taken_ms: number | null;
      percentile_rank: number;
      finished_at: string | null;
    }>(sql`
      WITH ranked AS (
        SELECT
          attempt_id,
          quiz_version_id,
          score_percent,
          correct_count,
          time_taken_ms,
          finished_at,
          PERCENT_RANK() OVER (
            PARTITION BY quiz_version_id
            ORDER BY score_percent::numeric ASC
          ) AS percentile_rank
        FROM quiz_attempts
        WHERE status = 'completed'
      ),
      question_counts AS (
        SELECT quiz_version_id, COUNT(*) AS total_questions
        FROM quiz_questions
        GROUP BY quiz_version_id
      )
      SELECT
        r.attempt_id,
        r.quiz_version_id,
        r.score_percent,
        r.correct_count,
        r.time_taken_ms,
        r.finished_at,
        COALESCE(qc.total_questions, 0)::int AS total_questions,
        ROUND((r.percentile_rank * 100)::numeric, 2)::float8 AS percentile_rank
      FROM ranked r
      LEFT JOIN question_counts qc ON qc.quiz_version_id = r.quiz_version_id
      WHERE r.attempt_id = ${attemptId}
      LIMIT 1
    `);

    if (!row) return null;

    return {
      attemptId: row.attempt_id,
      quizVersionId: row.quiz_version_id,
      scorePercent: row.score_percent,
      correctCount: row.correct_count !== null ? Number(row.correct_count) : null,
      totalQuestions: Number(row.total_questions),
      timeTakenMs: row.time_taken_ms !== null ? Number(row.time_taken_ms) : null,
      percentileRank: Number(row.percentile_rank),
      finishedAt: row.finished_at,
    };
  }

  /**
   * Returns aggregated attempt statistics for a given user.
   *
   * Mirrors the pattern used in UserRepository.getUserAnalytics:
   *  - Query 1: status counts, average score, total time, last attempt timestamp
   *  - Query 2: favorite category (most-attempted)
   *  - Query 3: favorite tag (most-attempted)
   *
   * All aggregation logic lives here; no business logic.
   */
  async getUserAttemptStats(userId: string): Promise<UserAttemptStatsRow> {
    const [summary] = await this.db
      .select({
        totalAttempts: sql<number>`COUNT(*)::int`,
        completedAttempts: sql<number>`COUNT(*) FILTER (WHERE ${quizAttempts.status} = 'completed')::int`,
        abandonedAttempts: sql<number>`COUNT(*) FILTER (WHERE ${quizAttempts.status} = 'abandoned')::int`,
        averageScore: sql<number>`ROUND(COALESCE(AVG(CASE WHEN ${quizAttempts.status} = 'completed' THEN ${quizAttempts.scorePercent}::numeric END), 0), 2)`,
        totalTimeTakenMs: sql<number>`COALESCE(SUM(${quizAttempts.timeTakenMs}), 0)::bigint`,
        lastAttemptAt: sql<string | null>`MAX(${quizAttempts.startedAt})`,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId));

    const [favoriteCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(quizCategories, eq(quizVersions.quizId, quizCategories.quizId))
      .innerJoin(categories, eq(quizCategories.categoryId, categories.categoryId))
      .where(and(eq(quizAttempts.userId, userId), isNull(categories.deletedAt)))
      .groupBy(categories.categoryId, categories.name)
      .orderBy(desc(sql`COUNT(*)`), categories.name)
      .limit(1);

    const [favoriteTag] = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(quizTags, eq(quizVersions.quizId, quizTags.quizId))
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .where(and(eq(quizAttempts.userId, userId), isNull(tags.deletedAt)))
      .groupBy(tags.tagId, tags.name)
      .orderBy(desc(sql`COUNT(*)`), tags.name)
      .limit(1);

    return {
      totalAttempts: Number(summary?.totalAttempts ?? 0),
      completedAttempts: Number(summary?.completedAttempts ?? 0),
      abandonedAttempts: Number(summary?.abandonedAttempts ?? 0),
      averageScore: Number(summary?.averageScore ?? 0),
      totalTimeTakenMs: Number(summary?.totalTimeTakenMs ?? 0),
      lastAttemptAt: summary?.lastAttemptAt ?? null,
      favoriteCategory: favoriteCategory
        ? { categoryId: favoriteCategory.categoryId, name: favoriteCategory.name }
        : null,
      favoriteTag: favoriteTag
        ? { tagId: favoriteTag.tagId, name: favoriteTag.name }
        : null,
    };
  }
}
