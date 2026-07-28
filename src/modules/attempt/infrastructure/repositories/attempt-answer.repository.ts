import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  quizAttemptAnswers,
  quizAnswerOptions,
  quizAttemptEvents,
  quizAttempts,
  quizQuestions,
} from '@/core/database/schema';
import type {
  AttemptAnswerRow,
  AttemptAnswerRepositoryPort,
} from '../../domain/ports/attempt-answer-repository.port';

@Injectable()
export class AttemptAnswerRepository implements AttemptAnswerRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getAttemptAnswersByAttemptId(attemptId: string): Promise<AttemptAnswerRow[]> {
    const rows = await this.db
      .select({
        attemptAnswerId: quizAttemptAnswers.attemptAnswerId,
        attemptId: quizAttemptAnswers.attemptId,
        questionId: quizAttemptAnswers.questionId,
        selectedOptionId: quizAttemptAnswers.selectedOptionId,
        answeredAt: quizAttemptAnswers.answeredAt,
        timeTakenMs: quizAttemptAnswers.timeTakenMs,
      })
      .from(quizAttemptAnswers)
      .where(eq(quizAttemptAnswers.attemptId, attemptId))
      .orderBy(quizAttemptAnswers.answeredAt);

    return rows as AttemptAnswerRow[];
  }

  async getAnswerByAttemptAndQuestion(
    attemptId: string,
    questionId: string,
  ): Promise<AttemptAnswerRow | null> {
    const [row] = await this.db
      .select({
        attemptAnswerId: quizAttemptAnswers.attemptAnswerId,
        attemptId: quizAttemptAnswers.attemptId,
        questionId: quizAttemptAnswers.questionId,
        selectedOptionId: quizAttemptAnswers.selectedOptionId,
        answeredAt: quizAttemptAnswers.answeredAt,
        timeTakenMs: quizAttemptAnswers.timeTakenMs,
      })
      .from(quizAttemptAnswers)
      .where(
        and(
          eq(quizAttemptAnswers.attemptId, attemptId),
          eq(quizAttemptAnswers.questionId, questionId),
        ),
      )
      .limit(1);

    return (row as AttemptAnswerRow | undefined) ?? null;
  }

  async getAttemptAnswerScoringData(
    attemptId: string,
  ): Promise<{ totalAnswers: number; correctCount: number }> {
    const answers = await this.db
      .select({
        attemptAnswerId: quizAttemptAnswers.attemptAnswerId,
        isCorrect: quizAnswerOptions.isCorrect,
      })
      .from(quizAttemptAnswers)
      .innerJoin(
        quizAnswerOptions,
        eq(quizAttemptAnswers.selectedOptionId, quizAnswerOptions.optionId),
      )
      .where(eq(quizAttemptAnswers.attemptId, attemptId));

    const correctCount = answers.filter((a) => a.isCorrect === true).length;
    return { totalAnswers: answers.length, correctCount };
  }

  async submitAnswer(params: {
    attemptId: string;
    questionId: string;
    selectedOptionId: string | null;
    nowIso: string;
    timeTakenMs?: number | null;
  }): Promise<AttemptAnswerRow> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ attemptId: quizAttempts.attemptId, status: quizAttempts.status })
        .from(quizAttempts)
        .where(eq(quizAttempts.attemptId, params.attemptId))
        .limit(1);

      if (!locked || locked.status !== 'started') {
        throw new Error('Attempt not active or not found');
      }

      const [created] = await tx
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
        });

      await tx.insert(quizAttemptEvents).values({
        attemptId: params.attemptId,
        eventType: 'answer.submitted',
        questionId: params.questionId,
        selectedOptionId: params.selectedOptionId,
        payload: {
          answeredAt: params.nowIso,
          timeTakenMs: params.timeTakenMs,
        },
      });

      return created as AttemptAnswerRow;
    });
  }

  async deleteAnswer(params: { attemptId: string; questionId: string }): Promise<void> {
    await this.db
      .delete(quizAttemptAnswers)
      .where(
        and(
          eq(quizAttemptAnswers.attemptId, params.attemptId),
          eq(quizAttemptAnswers.questionId, params.questionId),
        ),
      );
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
}
