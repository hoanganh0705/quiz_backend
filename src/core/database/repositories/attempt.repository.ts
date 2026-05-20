import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.constants';
import type { DrizzleDB } from '../database.module';
import { quizAttempts, quizAnswerOptions, quizQuestions, quizVersions, quizzes, quizAttemptAnswers, quizStats, users } from '../schema';
import type { AttemptContextType } from '@/modules/attempt/types/attempt.types';
import type {
  AttemptRow,
  AttemptDetailRow,
  AttemptListRow,
  AttemptAnswerRow,
  AttemptRepositoryPort,
} from '@/modules/attempt/domain/ports';

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
        quizId: quizzes.quizId,
        quizTitle: quizzes.title,
        quizSlug: quizzes.slug,
        quizCreatorId: quizzes.creatorId,
        versionNumber: quizVersions.versionNumber,
        difficulty: quizVersions.difficulty,
        durationMs: quizVersions.durationMs,
        passingScorePercent: quizVersions.passingScorePercent,
        rewardXp: quizVersions.rewardXp,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(quizzes, eq(quizVersions.quizId, quizzes.quizId))
      .where(
        and(
          eq(quizAttempts.attemptId, attemptId),
          isNull(quizzes.deletedAt),
        ),
      )
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
    cursor?: { startedAt: string; attemptId: string } | null;
  }): Promise<AttemptListRow[]> {
    const cursorCondition = params.cursor
      ? or(
          sql`${quizAttempts.startedAt} < ${params.cursor.startedAt}`,
          and(
            eq(quizAttempts.startedAt, params.cursor.startedAt),
            sql`${quizAttempts.attemptId} < ${params.cursor.attemptId}`,
          ),
        )
      : undefined;

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
        quizId: quizzes.quizId,
        quizTitle: quizzes.title,
        quizSlug: quizzes.slug,
        versionNumber: quizVersions.versionNumber,
        difficulty: quizVersions.difficulty,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(quizzes, eq(quizVersions.quizId, quizzes.quizId))
      .where(
        params.cursor
          ? and(eq(quizAttempts.userId, params.userId), cursorCondition)
          : eq(quizAttempts.userId, params.userId),
      )
      .orderBy(desc(quizAttempts.startedAt), desc(quizAttempts.attemptId))
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
      .leftJoin(quizAnswerOptions, eq(quizAttemptAnswers.selectedOptionId, quizAnswerOptions.optionId))
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
        and(
          eq(quizAnswerOptions.optionId, optionId),
          eq(quizAnswerOptions.questionId, questionId),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async checkAnswerExists(attemptId: string, questionId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ attemptAnswerId: quizAttemptAnswers.attemptAnswerId })
      .from(quizAttemptAnswers)
      .where(
        and(
          eq(quizAttemptAnswers.attemptId, attemptId),
          eq(quizAttemptAnswers.questionId, questionId),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async completeAttempt(params: {
    attemptId: string;
    scorePercent: string;
    correctCount: number;
    timeTakenMs: number;
    xpEarned: number;
    nowIso: string;
  }): Promise<AttemptRow> {
    const [updated] = await this.db
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
        and(
          eq(quizAttempts.attemptId, params.attemptId),
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

  async upsertQuizStats(params: {
    quizId: string;
    scorePercent: string;
    nowIso: string;
  }): Promise<void> {
    const existing = await this.db
      .select({
        totalAttempts: quizStats.totalAttempts,
        totalPlayers: quizStats.totalPlayers,
        avgScorePercent: quizStats.avgScorePercent,
      })
      .from(quizStats)
      .where(eq(quizStats.quizId, params.quizId))
      .limit(1);

    if (existing.length === 0 || !existing[0]) {
      await this.db.insert(quizStats).values({
        quizId: params.quizId,
        totalAttempts: 1,
        totalPlayers: 1,
        avgScorePercent: params.scorePercent,
        lastAttemptAt: params.nowIso,
        updatedAt: params.nowIso,
      });
      return;
    }

    const current = existing[0]!;
    const newTotalAttempts = Number(current.totalAttempts) + 1;

    // Recalculate running average: new_avg = old_avg + (new_value - old_avg) / n
    const oldAvg = parseFloat(current.avgScorePercent);
    const newScore = parseFloat(params.scorePercent);
    const newAvg = oldAvg + (newScore - oldAvg) / newTotalAttempts;

    await this.db
      .update(quizStats)
      .set({
        totalAttempts: newTotalAttempts,
        avgScorePercent: newAvg.toFixed(2),
        lastAttemptAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .where(eq(quizStats.quizId, params.quizId));
  }

  async addUserXp(params: { userId: string; xpToAdd: number }): Promise<void> {
    await this.db
      .update(users)
      .set({
        xpTotal: sql`${users.xpTotal} + ${params.xpToAdd}`,
      })
      .where(eq(users.userId, params.userId));
  }
}
