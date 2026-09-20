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
import { AttemptNotActiveError } from '../../domain/errors/attempt-domain.errors';
import { ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE } from '../../attempt.constants';

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
    // Push counting to PostgreSQL instead of fetching all rows and filtering in
    // memory. SUM/CASE is a single aggregation pass — no JavaScript iteration.
    const result = await this.db.execute<{ total: number | string; correct: number | string }>(
      sql`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(
            SUM(CASE WHEN qao.is_correct THEN 1 ELSE 0 END),
            0
          )::int AS correct
        FROM quiz_attempt_answers qaa
        INNER JOIN quiz_answer_options qao
          ON qaa.selected_option_id = qao.option_id
        WHERE qaa.attempt_id = ${attemptId}::uuid
      `,
    );

    // Drizzle raw SQL returns untyped rows
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const row = result.rows[0] as { total: number | string; correct: number | string } | undefined;

    return {
      totalAnswers: Number(row?.total ?? 0),
      correctCount: Number(row?.correct ?? 0),
    };
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
        throw new AttemptNotActiveError(ATTEMPT_NOT_STARTED_OR_FINISHED_MESSAGE);
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
