import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { normalizeNullableText } from '@/common/utils/text.util';
import { QUIZ_QUESTION_CORRECT_OPTION_MESSAGE } from '../../quiz.constants';
import {
  QUIZ_QUESTION_REPOSITORY_PORT,
  QUIZ_VERSION_REPOSITORY_PORT,
  type QuizQuestionRepositoryPort,
  type QuizQuestionJoinRow,
  type QuizVersionRepositoryPort,
} from '../ports';
import type {
  CreateQuizQuestionCommand,
  CreateQuizQuestionsCommand,
} from '../types/quiz-question.commands';
import { QuizValidationError, QuizNotFoundError, QuizConflictError } from '../errors';
import { QuizPolicy } from '../policies/quiz.policy';
import { QuizVersionPolicy } from '../policies/quiz-version.policy';

@Injectable()
export class QuizQuestionService {
  constructor(
    @Inject(QUIZ_QUESTION_REPOSITORY_PORT)
    private readonly quizQuestionRepository: QuizQuestionRepositoryPort,
    @Inject(QUIZ_VERSION_REPOSITORY_PORT)
    private readonly quizVersionRepository: QuizVersionRepositoryPort,
    @InjectPinoLogger(QuizQuestionService.name) private readonly logger: PinoLogger,
  ) {}

  private assertValidAnswerOptions(options: { position: number; isCorrect: boolean }[]): void {
    const positions = new Set<number>();
    let correctCount = 0;

    for (const option of options) {
      if (positions.has(option.position)) {
        throw new QuizValidationError('Duplicate answer option positions are not allowed');
      }

      positions.add(option.position);

      if (option.isCorrect) {
        correctCount += 1;
      }
    }

    if (correctCount !== 1) {
      throw new QuizValidationError(QUIZ_QUESTION_CORRECT_OPTION_MESSAGE);
    }
  }

  private assertUniqueQuestionPositions(questions: { position: number }[]): void {
    const positions = new Set<number>();

    for (const question of questions) {
      if (positions.has(question.position)) {
        throw new QuizValidationError('Duplicate question positions are not allowed');
      }

      positions.add(question.position);
    }
  }

  private async assertCanCreateQuestions(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
  ): Promise<void> {
    const version = await this.quizVersionRepository.getQuizVersionDetailById(quizVersionId);

    if (!version) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    if (version.quizId !== quizId) {
      throw new QuizValidationError('Invalid quiz version');
    }

    const isOwner = QuizPolicy.isOwner(version.quizCreatorId, user);

    // Throws QuizValidationError if not draft, QuizForbiddenError if no permission
    QuizVersionPolicy.assertCanAddQuestions(version.status, isOwner, user);
  }

  async getQuestionsByVersionId(quizVersionId: string): Promise<QuizQuestionJoinRow[]> {
    return this.quizQuestionRepository.getQuestionsByVersionId(quizVersionId);
  }

  async createQuizQuestion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    command: CreateQuizQuestionCommand,
  ): Promise<QuizQuestionJoinRow[]> {
    await this.assertCanCreateQuestions(quizId, quizVersionId, user);

    const nowIso = new Date().toISOString();
    const questionText = command.questionText.trim();
    const imageUrl = normalizeNullableText(command.imageUrl) ?? null;

    this.assertValidAnswerOptions(command.answerOptions);

    const questionId = await this.quizQuestionRepository.createQuestionWithOptions({
      quizVersionId,
      position: command.position,
      questionText,
      imageUrl,
      createdAt: nowIso,
      updatedAt: nowIso,
      answerOptions: command.answerOptions.map((option) => ({
        position: option.position,
        value: option.value.trim(),
        isCorrect: option.isCorrect,
        createdAt: nowIso,
      })),
    });

    const rows = await this.quizQuestionRepository.getQuestionById(questionId.questionId);

    if (rows.length === 0) {
      this.logger.error({ event: 'quiz_question_created_but_not_found', questionId });
      throw new QuizNotFoundError('Quiz question not found');
    }

    this.logger.info({
      event: 'quiz_question_created',
      questionId,
      quizVersionId,
      userId: user.sub,
    });

    return rows;
  }

  /**
   * Phase 5 (S-28): bulk-create with per-row outcomes.
   *
   * Iterates over each requested question and attempts to insert it
   * individually. A row-level failure (validation, conflict, etc.) is
   * captured as a per-row outcome and the loop continues, so one bad
   * row does not poison the rest of the batch. The caller receives a
   * `BulkQuizQuestionsResponseDto`-shaped record (questions + results).
   *
   * Authorization is checked once up front via
   * `assertCanCreateQuestions` (caller has edit rights + version is
   * draft). Per-row authorization is not re-checked.
   */
  async createQuizQuestions(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    command: CreateQuizQuestionsCommand,
  ): Promise<{
    questions: QuizQuestionJoinRow[];
    rowResults: Array<{
      index: number;
      status: number;
      code: string;
      message: string;
      questionId: string | null;
    }>;
  }> {
    await this.assertCanCreateQuestions(quizId, quizVersionId, user);

    // Pre-flight: positions must be unique within the batch — failing
    // fast here gives the editor a clearer "your batch has dupes" error
    // than running through and tagging N rows individually.
    this.assertUniqueQuestionPositions(command.questions);

    const nowIso = new Date().toISOString();
    const createdQuestions: QuizQuestionJoinRow[] = [];
    const rowResults: Array<{
      index: number;
      status: number;
      code: string;
      message: string;
      questionId: string | null;
    }> = [];

    for (let i = 0; i < command.questions.length; i++) {
      const question = command.questions[i]!;
      try {
        // Per-row validation; a thrown error here is caught below and
        // surfaced as a per-row failure without breaking the loop.
        const normalizedAnswerOptions = question.answerOptions.map((option) => ({
          ...option,
          value: option.value.trim(),
        }));
        this.assertValidAnswerOptions(normalizedAnswerOptions);

        const inserted = await this.quizQuestionRepository.createQuestionWithOptions({
          quizVersionId,
          position: question.position,
          questionText: question.questionText.trim(),
          imageUrl: normalizeNullableText(question.imageUrl) ?? null,
          createdAt: nowIso,
          updatedAt: nowIso,
          answerOptions: normalizedAnswerOptions.map((option) => ({
            position: option.position,
            value: option.value.trim(),
            isCorrect: option.isCorrect,
            createdAt: nowIso,
          })),
        });

        const rows = await this.quizQuestionRepository.getQuestionById(
          inserted.questionId,
        );
        if (rows.length === 0) {
          throw new QuizNotFoundError('Quiz question not found after insert');
        }
        createdQuestions.push(rows[0]!);
        rowResults.push({
          index: i,
          status: 201,
          code: '',
          message: '',
          questionId: rows[0]!.questionId,
        });
      } catch (err) {
        let code = 'GLOBAL_UNKNOWN';
        let message = err instanceof Error ? err.message : 'Unknown error';
        let status = 422;
        if (err instanceof QuizValidationError) {
          code = 'QUIZ_VALIDATION_FAILED';
          status = 422;
        } else if (err instanceof QuizConflictError) {
          code = 'QUIZ_QUESTION_POSITION_CONFLICT';
          status = 409;
        } else if (err instanceof QuizNotFoundError) {
          code = 'QUIZ_NOT_FOUND';
          status = 404;
        }
        this.logger.warn({
          event: 'quiz_question_bulk_row_failed',
          index: i,
          code,
          message,
          quizVersionId,
          userId: user.sub,
        });
        rowResults.push({
          index: i,
          status,
          code,
          message,
          questionId: null,
        });
      }
    }

    this.logger.info({
      event: 'quiz_questions_batch_created',
      total: command.questions.length,
      succeeded: createdQuestions.length,
      failed: command.questions.length - createdQuestions.length,
      quizVersionId,
      userId: user.sub,
    });

    return { questions: createdQuestions, rowResults };
  }
}
