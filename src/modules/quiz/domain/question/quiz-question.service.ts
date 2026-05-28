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
import { QuizValidationError, QuizNotFoundError } from '../errors';
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

  async createQuizQuestions(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    command: CreateQuizQuestionsCommand,
  ): Promise<QuizQuestionJoinRow[]> {
    await this.assertCanCreateQuestions(quizId, quizVersionId, user);
    this.assertUniqueQuestionPositions(command.questions);

    const nowIso = new Date().toISOString();
    const questions = command.questions.map((question) => {
      const normalizedAnswerOptions = question.answerOptions.map((option) => ({
        ...option,
        value: option.value.trim(),
      }));

      this.assertValidAnswerOptions(normalizedAnswerOptions);

      return {
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
      };
    });

    const result = await this.quizQuestionRepository.createQuestionsWithOptions(questions);

    const rows = await this.quizQuestionRepository.getQuestionsByIds(result.questionIds);

    if (rows.length === 0) {
      this.logger.error({
        event: 'quiz_questions_created_but_not_found',
        questionIds: result.questionIds,
      });
      throw new QuizNotFoundError('Quiz questions not found');
    }

    this.logger.info({
      event: 'quiz_questions_batch_created',
      count: rows.length,
      quizVersionId,
      userId: user.sub,
    });

    return rows;
  }
}
