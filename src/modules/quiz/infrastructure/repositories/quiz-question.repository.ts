import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizAnswerOptions, quizQuestions } from '@/core/database/schema';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import {
  QuizQuestionPositionConflictError,
  QuizAnswerOptionPositionConflictError,
  QuizMultipleCorrectOptionsError,
  QuizOperationFailedError,
} from '@/modules/quiz/domain/errors';
import {
  QUIZ_QUESTION_POSITION_CONFLICT_MESSAGE,
  QUIZ_QUESTION_OPTION_POSITION_CONFLICT_MESSAGE,
  QUIZ_QUESTION_CORRECT_OPTION_MESSAGE,
} from '@/modules/quiz/quiz.constants';
import type { QuizQuestionJoinRow, QuizQuestionRepositoryPort } from '@/modules/quiz/domain/ports';

const QUIZ_QUESTION_JOIN_PROJECTION = {
  questionId: quizQuestions.questionId,
  quizVersionId: quizQuestions.quizVersionId,
  position: quizQuestions.position,
  questionText: quizQuestions.questionText,
  imageUrl: quizQuestions.imageUrl,
  createdAt: quizQuestions.createdAt,
  updatedAt: quizQuestions.updatedAt,
  optionId: quizAnswerOptions.optionId,
  optionPosition: quizAnswerOptions.position,
  optionValue: quizAnswerOptions.value,
  optionIsCorrect: quizAnswerOptions.isCorrect,
  optionCreatedAt: quizAnswerOptions.createdAt,
};

@Injectable()
export class QuizQuestionRepository implements QuizQuestionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getQuestionsByVersionId(quizVersionId: string): Promise<QuizQuestionJoinRow[]> {
    const rows = await this.db
      .select(QUIZ_QUESTION_JOIN_PROJECTION)
      .from(quizQuestions)
      .leftJoin(quizAnswerOptions, eq(quizQuestions.questionId, quizAnswerOptions.questionId))
      .where(eq(quizQuestions.quizVersionId, quizVersionId))
      .orderBy(quizQuestions.position, quizAnswerOptions.position);

    return rows as QuizQuestionJoinRow[];
  }

  async getQuestionById(questionId: string): Promise<QuizQuestionJoinRow[]> {
    const rows = await this.db
      .select(QUIZ_QUESTION_JOIN_PROJECTION)
      .from(quizQuestions)
      .leftJoin(quizAnswerOptions, eq(quizQuestions.questionId, quizAnswerOptions.questionId))
      .where(eq(quizQuestions.questionId, questionId))
      .orderBy(quizQuestions.position, quizAnswerOptions.position);

    return rows as QuizQuestionJoinRow[];
  }

  async getQuestionsByIds(questionIds: string[]): Promise<QuizQuestionJoinRow[]> {
    if (questionIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select(QUIZ_QUESTION_JOIN_PROJECTION)
      .from(quizQuestions)
      .leftJoin(quizAnswerOptions, eq(quizQuestions.questionId, quizAnswerOptions.questionId))
      .where(inArray(quizQuestions.questionId, questionIds))
      .orderBy(quizQuestions.position, quizAnswerOptions.position);

    return rows as QuizQuestionJoinRow[];
  }

  async createQuestionWithOptions(params: {
    quizVersionId: string;
    position: number;
    questionText: string;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    answerOptions: {
      position: number;
      value: string;
      isCorrect: boolean;
      createdAt: string;
    }[];
  }): Promise<{ questionId: string }> {
    try {
      const result = await this.db.transaction(async (tx) => {
        const [createdQuestion] = await tx
          .insert(quizQuestions)
          .values({
            quizVersionId: params.quizVersionId,
            position: params.position,
            questionText: params.questionText,
            imageUrl: params.imageUrl,
            createdAt: params.createdAt,
            updatedAt: params.updatedAt,
          })
          .returning({
            questionId: quizQuestions.questionId,
          });

        await tx.insert(quizAnswerOptions).values(
          params.answerOptions.map((option) => ({
            questionId: createdQuestion.questionId,
            position: option.position,
            value: option.value,
            isCorrect: option.isCorrect,
            createdAt: option.createdAt,
          })),
        );

        return createdQuestion;
      });

      return { questionId: result.questionId };
    } catch (error) {
      this.mapInsertError(error);
    }
  }

  async createQuestionsWithOptions(
    params: {
      quizVersionId: string;
      position: number;
      questionText: string;
      imageUrl: string | null;
      createdAt: string;
      updatedAt: string;
      answerOptions: {
        position: number;
        value: string;
        isCorrect: boolean;
        createdAt: string;
      }[];
    }[],
  ): Promise<{ questionIds: string[] }> {
    try {
      const questionIds = await this.db.transaction(async (tx) => {
        const createdQuestionIds: string[] = [];

        for (const question of params) {
          const [createdQuestion] = await tx
            .insert(quizQuestions)
            .values({
              quizVersionId: question.quizVersionId,
              position: question.position,
              questionText: question.questionText,
              imageUrl: question.imageUrl,
              createdAt: question.createdAt,
              updatedAt: question.updatedAt,
            })
            .returning({
              questionId: quizQuestions.questionId,
            });

          createdQuestionIds.push(createdQuestion.questionId);

          await tx.insert(quizAnswerOptions).values(
            question.answerOptions.map((option) => ({
              questionId: createdQuestion.questionId,
              position: option.position,
              value: option.value,
              isCorrect: option.isCorrect,
              createdAt: option.createdAt,
            })),
          );
        }

        return createdQuestionIds;
      });

      return { questionIds };
    } catch (error) {
      this.mapInsertError(error);
    }
  }

  async countQuestionsByVersionId(quizVersionId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(${quizQuestions.questionId})` })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizVersionId, quizVersionId));

    return row?.count ?? 0;
  }

  private mapInsertError(error: unknown): never {
    if (isPostgresUniqueViolation(error)) {
      const maybePgError = error as { constraint?: string };

      if (maybePgError.constraint === 'uq_quiz_questions_version_position') {
        throw new QuizQuestionPositionConflictError(QUIZ_QUESTION_POSITION_CONFLICT_MESSAGE);
      }

      if (maybePgError.constraint === 'uq_quiz_answer_options_question_position') {
        throw new QuizAnswerOptionPositionConflictError(
          QUIZ_QUESTION_OPTION_POSITION_CONFLICT_MESSAGE,
        );
      }

      if (maybePgError.constraint === 'uq_quiz_answer_options_one_correct') {
        throw new QuizMultipleCorrectOptionsError(QUIZ_QUESTION_CORRECT_OPTION_MESSAGE);
      }
    }

    throw new QuizOperationFailedError('Quiz question operation failed');
  }
}
