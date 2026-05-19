import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.constants';
import type { DrizzleDB } from '../database.module';
import { quizAnswerOptions, quizQuestions } from '../schema';
import type { QuizQuestionJoinRow, QuizQuestionRepositoryPort } from '@/modules/quiz/domain/ports';

@Injectable()
export class QuizQuestionRepository implements QuizQuestionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getQuestionsByVersionId(quizVersionId: string): Promise<QuizQuestionJoinRow[]> {
    const rows = await this.db
      .select({
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
      })
      .from(quizQuestions)
      .leftJoin(quizAnswerOptions, eq(quizQuestions.questionId, quizAnswerOptions.questionId))
      .where(eq(quizQuestions.quizVersionId, quizVersionId))
      .orderBy(quizQuestions.position, quizAnswerOptions.position);

    return rows as QuizQuestionJoinRow[];
  }

  async getQuestionById(questionId: string): Promise<QuizQuestionJoinRow[]> {
    const rows = await this.db
      .select({
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
      })
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
      .select({
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
      })
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
  }
}
