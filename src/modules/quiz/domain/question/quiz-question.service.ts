import { Inject, Injectable } from '@nestjs/common';
import { hasPermission, Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CreateQuizQuestionDto } from '../../dto/request/create-quiz-question.dto';
import { normalizeNullableText } from '@/common/utils/text.util';
import { canEditQuizVersion } from '../../authz/quiz-authorization.helper';
import {
  QUIZ_QUESTION_CORRECT_OPTION_MESSAGE,
  QUIZ_QUESTION_OPTION_POSITION_CONFLICT_MESSAGE,
  QUIZ_QUESTION_POSITION_CONFLICT_MESSAGE,
} from '../../quiz.constants';
import {
  QUIZ_QUESTION_REPOSITORY_PORT,
  type QuizQuestionRepositoryPort,
  type QuizQuestionJoinRow,
} from '../ports/quiz-question-repository.port';
import {
  QUIZ_VERSION_REPOSITORY_PORT,
  type QuizVersionRepositoryPort,
} from '../ports/quiz-version-repository.port';
import {
  QuizNotFoundError,
  QuizForbiddenError,
  QuizConflictError,
  QuizValidationError,
  QuizDomainError,
} from '../errors';

@Injectable()
export class QuizQuestionService {
  constructor(
    @Inject(QUIZ_QUESTION_REPOSITORY_PORT)
    private readonly quizQuestionRepository: QuizQuestionRepositoryPort,
    @Inject(QUIZ_VERSION_REPOSITORY_PORT)
    private readonly quizVersionRepository: QuizVersionRepositoryPort,
  ) {}

  private mapQuestionInsertError(error: unknown): never {
    const maybePgError = error as { code?: string; constraint?: string };

    if (maybePgError.code === '23505') {
      if (maybePgError.constraint === 'uq_quiz_questions_version_position') {
        throw new QuizConflictError(QUIZ_QUESTION_POSITION_CONFLICT_MESSAGE);
      }

      if (maybePgError.constraint === 'uq_quiz_answer_options_question_position') {
        throw new QuizConflictError(QUIZ_QUESTION_OPTION_POSITION_CONFLICT_MESSAGE);
      }

      if (maybePgError.constraint === 'uq_quiz_answer_options_one_correct') {
        throw new QuizValidationError(QUIZ_QUESTION_CORRECT_OPTION_MESSAGE);
      }
    }

    throw new QuizDomainError('Quiz question operation failed');
  }

  private normalizeAnswerOptions(
    options: CreateQuizQuestionDto['answerOptions'],
  ): CreateQuizQuestionDto['answerOptions'] {
    return options.map((option) => ({
      ...option,
      value: option.value.trim(),
    }));
  }

  private assertValidAnswerOptions(options: CreateQuizQuestionDto['answerOptions']): void {
    const positions = new Set<number>();
    let correctCount = 0;

    for (const option of options) {
      if (positions.has(option.position)) {
        throw new QuizValidationError(QUIZ_QUESTION_OPTION_POSITION_CONFLICT_MESSAGE);
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

  async getQuestionsByVersionId(quizVersionId: string): Promise<QuizQuestionJoinRow[]> {
    return this.quizQuestionRepository.getQuestionsByVersionId(quizVersionId);
  }

  async createQuizQuestion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    payload: CreateQuizQuestionDto,
  ): Promise<QuizQuestionJoinRow[]> {
    const version = await this.quizVersionRepository.getQuizVersionDetailById(quizVersionId);

    if (!version) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    if (version.quizId !== quizId) {
      throw new QuizValidationError('Invalid quiz version');
    }

    const isOwner = !!version.quizCreatorId && version.quizCreatorId === user.sub;
    const canEditOwn = hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_OWN);
    const canEditAny = hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_ANY);

    if (
      !canEditQuizVersion({
        status: version.status,
        isOwner,
        canEditAny,
        canEditOwn,
      })
    ) {
      if (version.status !== 'draft') {
        throw new QuizValidationError('Only draft versions can be edited');
      }

      throw new QuizForbiddenError('You do not have permission to edit this quiz version');
    }

    const nowIso = new Date().toISOString();
    const questionText = payload.questionText.trim();
    const imageUrl = normalizeNullableText(payload.imageUrl) ?? null;
    const answerOptions = this.normalizeAnswerOptions(payload.answerOptions);

    this.assertValidAnswerOptions(answerOptions);

    let questionId = '';

    try {
      const createdQuestion = await this.quizQuestionRepository.createQuestionWithOptions({
        quizVersionId,
        position: payload.position,
        questionText,
        imageUrl,
        createdAt: nowIso,
        updatedAt: nowIso,
        answerOptions: answerOptions.map((option) => ({
          position: option.position,
          value: option.value.trim(),
          isCorrect: option.isCorrect,
          createdAt: nowIso,
        })),
      });

      questionId = createdQuestion.questionId;
    } catch (error: unknown) {
      this.mapQuestionInsertError(error);
    }

    const rows = await this.quizQuestionRepository.getQuestionById(questionId);

    if (rows.length === 0) {
      throw new QuizNotFoundError('Quiz question not found');
    }

    return rows;
  }
}
