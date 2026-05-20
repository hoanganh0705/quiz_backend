import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.constants';
import type { DrizzleDB } from '../database.module';
import { quizAttempts, quizAnswerOptions, quizQuestions, quizVersions, quizzes, quizAttemptAnswers } from '../schema';
import type { AttemptContextType } from '@/modules/attempt/types/attempt.types';
import type {
  AttemptRow,
  AttemptDetailRow,
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
  }): Promise<AttemptRow[]> {
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
      })
      .from(quizAttempts)
      .where(
        params.cursor
          ? and(eq(quizAttempts.userId, params.userId), cursorCondition)
          : eq(quizAttempts.userId, params.userId),
      )
      .orderBy(desc(quizAttempts.startedAt), desc(quizAttempts.attemptId))
      .limit(params.limit + 1);

    return rows as AttemptRow[];
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
}
