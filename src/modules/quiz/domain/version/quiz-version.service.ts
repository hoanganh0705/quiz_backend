import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  QUIZ_VERSION_REPOSITORY_PORT,
  QUIZ_QUESTION_REPOSITORY_PORT,
  QUIZ_DOMAIN_EVENT_BUS,
  type QuizVersionRepositoryPort,
  type QuizVersionRow,
  type QuizQuestionRepositoryPort,
} from '../ports';
import type { CreateQuizVersionCommand } from '../types/create-quiz-version.command';
import type { UpdateQuizVersionCommand } from '../types/quiz-version-commands';
import type { ListQuizVersionsQuery } from '../types/list-quiz-versions.query';
import type { QuizQuestionJoinRow } from '../ports/quiz-question-repository.port';
import {
  MIN_QUESTIONS_TO_PUBLISH,
  QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE,
} from '../../quiz.constants';
import { QuizQueryService } from '../quiz/quiz-query.service';
import type { QuizVersionCursor } from '../ports';
import { QuizNotFoundError, QuizForbiddenError, QuizInsufficientQuestionsError } from '../errors';
import { assertCanEditOrDraftFrom, isAlreadyPublished } from './quiz-version-state-machine';
import { QuizPolicy } from '../policies/quiz.policy';
import { QuizVersionPolicy } from '../policies/quiz-version.policy';
import { QuizVersionCreatedEvent, QuizVersionPublishedEvent } from '../events/quiz-domain.events';
import { QuizDomainEventBus } from '../events/quiz-domain.event-bus';

export type ListQuizVersionsResult = {
  rows: QuizVersionRow[];
  limit: number;
  hasNextPage: boolean;
  nextCursor: QuizVersionCursor | null;
};

@Injectable()
export class QuizVersionService {
  constructor(
    @Inject(QUIZ_VERSION_REPOSITORY_PORT)
    private readonly quizVersionRepository: QuizVersionRepositoryPort,
    @Inject(QUIZ_QUESTION_REPOSITORY_PORT)
    private readonly quizQuestionRepository: QuizQuestionRepositoryPort,
    private readonly quizQueryService: QuizQueryService,
    @Inject(QUIZ_DOMAIN_EVENT_BUS) private readonly eventBus: QuizDomainEventBus,
    @InjectPinoLogger(QuizVersionService.name) private readonly logger: PinoLogger,
  ) {}

  async createQuizVersion(
    quizId: string,
    user: JwtPayload,
    command: CreateQuizVersionCommand,
  ): Promise<QuizVersionRow> {
    const quiz = await this.quizQueryService.getActiveQuizRecordById(quizId);
    const isOwner = QuizPolicy.isOwner(quiz.creatorId, user);
    QuizVersionPolicy.assertCanCreate(isOwner, user);
    const nowIso = new Date().toISOString();

    if (command.sourceVersionId) {
      const sourceVersion = await this.quizVersionRepository.getQuizVersionDetailById(
        command.sourceVersionId,
      );

      if (!sourceVersion) {
        throw new QuizNotFoundError('Source version not found');
      }

      if (sourceVersion.quizId !== quizId) {
        throw new QuizNotFoundError('Source version not found');
      }

      const isSourceOwner = QuizPolicy.isOwner(sourceVersion.quizCreatorId, user);
      const canUseSourceVersion =
        QuizVersionPolicy.getEditTransition(sourceVersion.status, isSourceOwner, user) !==
        'blocked';

      if (!canUseSourceVersion) {
        throw new QuizForbiddenError('You do not have permission to use this source version');
      }

      const result = await this.quizVersionRepository.createDraftFromSourceVersion({
        sourceVersion,
        userId: user.sub,
        command,
        nowIso,
      });

      this.logger.info({
        event: 'quiz_version_created',
        quizId,
        versionId: result.quizVersionId,
        versionNumber: result.versionNumber,
        userId: user.sub,
        sourceVersionId: command.sourceVersionId,
      });

      this.eventBus.emitQuizVersionCreated(
        new QuizVersionCreatedEvent(
          result.quizVersionId,
          quizId,
          user.sub,
          result.versionNumber,
          nowIso,
        ),
      );

      return result;
    }

    const versionNumber = await this.quizVersionRepository.getNextVersionNumber(quizId);

    const result = await this.quizVersionRepository.createQuizVersion({
      quizId,
      versionNumber,
      difficulty: command.difficulty,
      durationMs: command.durationMs,
      passingScorePercent: command.passingScorePercent,
      rewardXp: command.rewardXp,
      createdByUserId: user.sub,
      nowIso,
    });

    this.logger.info({
      event: 'quiz_version_created',
      quizId,
      versionId: result.quizVersionId,
      versionNumber,
      userId: user.sub,
    });

    this.eventBus.emitQuizVersionCreated(
      new QuizVersionCreatedEvent(result.quizVersionId, quizId, user.sub, versionNumber, nowIso),
    );

    return result;
  }

  async listQuizVersions(
    quizId: string,
    user: JwtPayload,
    query: ListQuizVersionsQuery,
  ): Promise<ListQuizVersionsResult> {
    const quiz = await this.quizQueryService.getActiveQuizRecordById(quizId);
    const isOwner = QuizPolicy.isOwner(quiz.creatorId, user);

    QuizVersionPolicy.assertCanView(isOwner, user);

    const rows = await this.quizVersionRepository.listQuizVersions({
      quizId,
      limit: query.limit,
      cursor: query.cursor,
    });

    const hasNextPage = rows.length > query.limit;
    const items = hasNextPage ? rows.slice(0, query.limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit: query.limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, quizVersionId: lastItem.quizVersionId }
          : null,
    };
  }

  async getQuizVersionDetail(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
  ): Promise<{ version: QuizVersionDetailRow; questions: QuizQuestionJoinRow[] }> {
    const quiz = await this.quizQueryService.getActiveQuizRecordById(quizId);
    const isOwner = QuizPolicy.isOwner(quiz.creatorId, user);

    QuizVersionPolicy.assertCanView(isOwner, user);

    const version = await this.quizVersionRepository.getQuizVersionDetailByQuizId({
      quizId,
      quizVersionId,
    });

    if (!version) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    const questions = await this.quizQuestionRepository.getQuestionsByVersionId(quizVersionId);

    return { version, questions };
  }

  async updateQuizVersion(
    quizVersionId: string,
    user: JwtPayload,
    command: UpdateQuizVersionCommand,
  ): Promise<QuizVersionRow> {
    const version = await this.quizVersionRepository.getQuizVersionDetailById(quizVersionId);

    if (!version) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    const isOwner = QuizPolicy.isOwner(version.quizCreatorId, user);

    const transition = assertCanEditOrDraftFrom(version.status, isOwner, user);

    if (transition === 'draft-from-published') {
      return this.quizVersionRepository.createDraftFromSourceVersion({
        sourceVersion: version,
        userId: user.sub,
        command,
        nowIso: new Date().toISOString(),
      });
    }

    // transition === 'edit' (draft)
    const nowIso = new Date().toISOString();

    await this.quizVersionRepository.updateQuizVersion({
      quizVersionId,
      patch: {
        difficulty: command.difficulty ?? version.difficulty,
        durationMs: command.durationMs ?? version.durationMs,
        passingScorePercent: command.passingScorePercent ?? version.passingScorePercent,
        rewardXp: command.rewardXp ?? version.rewardXp,
        updatedAt: nowIso,
      },
    });

    const updated = await this.quizVersionRepository.getQuizVersionById(quizVersionId);

    if (!updated) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    return updated;
  }

  async publishQuizVersion(quizVersionId: string, user: JwtPayload): Promise<QuizVersionRow> {
    const version = await this.quizVersionRepository.getQuizVersionDetailById(quizVersionId);

    if (!version) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    // Idempotent: already published → return current state without further side-effects.
    if (isAlreadyPublished(version.status)) {
      const current = await this.quizVersionRepository.getQuizVersionById(quizVersionId);
      if (!current) throw new QuizNotFoundError('Quiz version not found');
      return current;
    }

    const isOwner = QuizPolicy.isOwner(version.quizCreatorId, user);

    // Throws QuizValidationError or QuizForbiddenError as appropriate.
    try {
      QuizVersionPolicy.assertCanPublish(
        version.status,
        isOwner,
        user,
        version.quizIsVerified,
        version.quizIsHidden,
      );
    } catch (err) {
      if (err instanceof QuizForbiddenError) {
        this.logger.warn({
          event: 'quiz_version_publish_forbidden',
          quizVersionId,
          userId: user.sub,
        });
      }
      throw err;
    }

    const questionCount =
      await this.quizQuestionRepository.countQuestionsByVersionId(quizVersionId);
    if (questionCount < MIN_QUESTIONS_TO_PUBLISH) {
      this.logger.warn({
        event: 'quiz_version_publish_insufficient_questions',
        quizVersionId,
        quizId: version.quizId,
        questionCount,
        required: MIN_QUESTIONS_TO_PUBLISH,
      });
      throw new QuizInsufficientQuestionsError(QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE);
    }

    const nowIso = new Date().toISOString();

    const publishedVersion = await this.quizVersionRepository.publishQuizVersionAndSetQuiz({
      quizId: version.quizId,
      quizVersionId,
      nowIso,
    });

    if (!publishedVersion) {
      const current = await this.quizVersionRepository.getQuizVersionById(quizVersionId);

      if (!current) {
        this.logger.error({
          event: 'quiz_version_publish_unexpected_null',
          quizVersionId,
        });
        throw new QuizNotFoundError('Quiz version not found');
      }

      return current;
    }

    this.logger.info({
      event: 'quiz_version_published',
      quizVersionId,
      quizId: version.quizId,
      userId: user.sub,
    });

    this.eventBus.emitQuizVersionPublished(
      new QuizVersionPublishedEvent(
        quizVersionId,
        version.quizId,
        user.sub,
        publishedVersion.versionNumber,
        nowIso,
      ),
    );

    return publishedVersion;
  }
}
