import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizAttempts, quizVersions, quizzes, quizAttemptEvents } from '@/core/database/schema';
import type { AttemptContextType } from '@/modules/attempt/types/attempt.types';
import type {
  AttemptListCursorPayload,
  AttemptListSortField,
} from '@/modules/attempt/mappers/attempt-cursor.mapper';
import type {
  AttemptRow,
  AttemptDetailRow,
  AttemptListRow,
  AttemptAnalyticsRow,
  UserAttemptStatsRow,
  AttemptRepositoryPort,
} from '@/modules/attempt/domain/ports';

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
  title: AnyPgColumn;
  slug: AnyPgColumn;
  creatorId: AnyPgColumn;
  categoryId: AnyPgColumn;
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
      filters.push(sql`${QUIZ_COLUMNS.categoryId} = ${params.categoryId}`);
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
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
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

      if (!updated) {
        throw new Error('Failed to abandon attempt — record not found or not active');
      }

      await tx.insert(quizAttemptEvents).values({
        attemptId: params.attemptId,
        eventType: 'attempt.abandoned',
        payload: {
          abandonedAt: params.nowIso,
        },
      });

      return updated as AttemptRow;
    });
  }

  async checkAnswerOptionBelongsToQuestion(
    _questionId: string,
    _optionId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ optionId: quizAttempts.attemptId })
      .from(quizAttempts)
      .where(sql`1=0`)
      .limit(1);

    return row !== undefined;
  }

  async countQuestionsByVersionId(_quizVersionId: string): Promise<number> {
    return Promise.resolve(0);
  }

  async checkQuestionBelongsToVersion(
    _questionId: string,
    _quizVersionId: string,
  ): Promise<boolean> {
    return Promise.resolve(true);
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

      await tx.execute(sql`
        INSERT INTO quiz_stats (
          quiz_id,
          total_attempts,
          total_players,
          avg_score_percent,
          last_attempt_at,
          updated_at
        )
        VALUES (
          ${params.quizId}::uuid,
          1,
          1,
          ${params.scorePercent}::numeric(5,2),
          ${params.nowIso}::timestamptz,
          ${params.nowIso}::timestamptz
        )
        ON CONFLICT (quiz_id) DO UPDATE SET
          total_attempts = quiz_stats.total_attempts + 1,
          avg_score_percent = (
            (quiz_stats.avg_score_percent * quiz_stats.total_attempts + ${params.scorePercent}::numeric(5,2))
            / (quiz_stats.total_attempts + 1)
          )::numeric(5,2),
          last_attempt_at = ${params.nowIso}::timestamptz,
          updated_at = ${params.nowIso}::timestamptz
      `);

      await tx.insert(quizAttemptEvents).values({
        attemptId: params.attemptId,
        eventType: 'attempt.completed',
        payload: {
          scorePercent: params.scorePercent,
          correctCount: params.correctCount,
          timeTakenMs: params.timeTakenMs,
          xpEarned: params.xpEarned,
          completedAt: params.nowIso,
        },
      });

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

  async getAttemptAnalytics(attemptId: string): Promise<AttemptAnalyticsRow | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const attemptAnalyticsRow: AttemptAnalyticsRow = {
      attemptId: row.attempt_id,
      quizVersionId: row.quiz_version_id,
      scorePercent: row.score_percent,
      correctCount: row.correct_count !== null ? Number(row.correct_count) : null,
      totalQuestions: Number(row.total_questions),
      timeTakenMs: row.time_taken_ms !== null ? Number(row.time_taken_ms) : null,
      percentileRank: Number(row.percentile_rank),
      finishedAt: row.finished_at,
    };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    return attemptAnalyticsRow;
  }

  async getUserAttemptStats(userId: string): Promise<UserAttemptStatsRow> {
    // Drizzle raw SQL returns untyped rows
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await this.db.execute(
      sql<{
        totalAttempts: number | string;
        completedAttempts: number | string;
        abandonedAttempts: number | string;
        averageScore: number | string;
        totalTimeTakenMs: number | string;
        lastAttemptAt: string | null;
        favoriteCategoryId: string | null;
        favoriteCategoryName: string | null;
        favoriteTagId: string | null;
        favoriteTagName: string | null;
      }>`
        WITH summary AS (
          SELECT
            COUNT(*)::int AS "totalAttempts",
            COUNT(*) FILTER (WHERE a.status = 'completed')::int AS "completedAttempts",
            COUNT(*) FILTER (WHERE a.status = 'abandoned')::int AS "abandonedAttempts",
            ROUND(
              COALESCE(
                AVG(CASE WHEN a.status = 'completed' THEN a.score_percent::numeric END),
                0
              ),
              2
            ) AS "averageScore",
            COALESCE(SUM(a.time_taken_ms), 0)::bigint AS "totalTimeTakenMs",
            MAX(a.started_at) AS "lastAttemptAt"
          FROM quiz_attempts a
          WHERE a.user_id = ${userId}::uuid
        ),
        category_counts AS (
          SELECT
            c.category_id AS "categoryId",
            c.name AS "name",
            COUNT(*)::bigint AS cnt,
            ROW_NUMBER() OVER (
              ORDER BY COUNT(*) DESC, c.name ASC
            ) AS rn
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN quizzes q ON q.quiz_id = v.quiz_id
          INNER JOIN categories c ON c.category_id = q.category_id
          WHERE a.user_id = ${userId}::uuid
            AND c.deleted_at IS NULL
          GROUP BY c.category_id, c.name
        ),
        tag_counts AS (
          SELECT
            t.tag_id AS "tagId",
            t.name AS "name",
            COUNT(*)::bigint AS cnt,
            ROW_NUMBER() OVER (
              ORDER BY COUNT(*) DESC, t.name ASC
            ) AS rn
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN quiz_tags qt ON qt.quiz_id = v.quiz_id
          INNER JOIN tags t ON t.tag_id = qt.tag_id
          WHERE a.user_id = ${userId}::uuid
            AND t.deleted_at IS NULL
          GROUP BY t.tag_id, t.name
        )
        SELECT
          s."totalAttempts",
          s."completedAttempts",
          s."abandonedAttempts",
          s."averageScore",
          s."totalTimeTakenMs",
          s."lastAttemptAt",
          (SELECT category_id FROM category_counts WHERE rn = 1) AS "favoriteCategoryId",
          (SELECT name FROM category_counts WHERE rn = 1) AS "favoriteCategoryName",
          (SELECT tag_id FROM tag_counts WHERE rn = 1) AS "favoriteTagId",
          (SELECT name FROM tag_counts WHERE rn = 1) AS "favoriteTagName"
        FROM summary s
      `,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const row = result.rows[0] as
      | {
          totalAttempts: number | string;
          completedAttempts: number | string;
          abandonedAttempts: number | string;
          averageScore: number | string;
          totalTimeTakenMs: number | string;
          lastAttemptAt: string | null;
          favoriteCategoryId: string | null;
          favoriteCategoryName: string | null;
          favoriteTagId: string | null;
          favoriteTagName: string | null;
        }
      | undefined;

    return {
      totalAttempts: Number(row?.totalAttempts ?? 0),
      completedAttempts: Number(row?.completedAttempts ?? 0),
      abandonedAttempts: Number(row?.abandonedAttempts ?? 0),
      averageScore: Number(row?.averageScore ?? 0),
      totalTimeTakenMs: Number(row?.totalTimeTakenMs ?? 0),
      lastAttemptAt: row?.lastAttemptAt ?? null,
      favoriteCategory:
        row?.favoriteCategoryId && row?.favoriteCategoryName
          ? {
              categoryId: row.favoriteCategoryId,
              name: row.favoriteCategoryName,
            }
          : null,
      favoriteTag:
        row?.favoriteTagId && row?.favoriteTagName
          ? { tagId: row.favoriteTagId, name: row.favoriteTagName }
          : null,
    };
  }

  async countCompletedAttempts(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, 'completed')));

    return row?.count ?? 0;
  }
}
