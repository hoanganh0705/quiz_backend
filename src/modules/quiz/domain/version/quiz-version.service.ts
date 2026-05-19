import { Inject, Injectable } from '@nestjs/common';
import { hasPermission, Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  QUIZ_VERSION_REPOSITORY_PORT,
  type QuizVersionRepositoryPort,
  type QuizVersionDetailRow,
  type QuizVersionRow,
} from '../ports/quiz-version-repository.port';
import { CreateQuizVersionDto } from '../../dto/request/create-quiz-version.dto';
import { ListQuizVersionsQueryDto } from '../../dto/request/list-quiz-versions-query.dto';
import { UpdateQuizVersionDto } from '../../dto/request/update-quiz-version.dto';
import {
  canEditQuizVersion,
  canManageOwnOrAny,
  canPublishQuizVersion,
} from '../../authz/quiz-authorization.helper';
import { QUIZ_VERSION_CONFLICT_MESSAGE } from '../../quiz.constants';
import { QuizReadService } from '../quiz/quiz-read.service';
import { decodeQuizVersionCursor, encodeQuizVersionCursor } from '../shared/quiz-utils';
import {
  QuizNotFoundError,
  QuizForbiddenError,
  QuizConflictError,
  QuizValidationError,
  QuizVersionImmutableError,
  QuizDomainError,
} from '../errors';

@Injectable()
export class QuizVersionService {
  constructor(
    @Inject(QUIZ_VERSION_REPOSITORY_PORT)
    private readonly quizVersionRepository: QuizVersionRepositoryPort,
    private readonly quizReadService: QuizReadService,
  ) {}

  private mapVersionInsertError(error: unknown): never {
    const maybePgError = error as { code?: string; constraint?: string };

    if (maybePgError.code === '23505') {
      throw new QuizConflictError(QUIZ_VERSION_CONFLICT_MESSAGE);
    }

    if (maybePgError.code === '23503') {
      throw new QuizNotFoundError('Quiz not found');
    }

    throw new QuizDomainError('Quiz version operation failed');
  }

  private async assertQuizManagePermission(quizId: string, user: JwtPayload): Promise<void> {
    const quiz = await this.quizReadService.getActiveQuizRecordById(quizId);
    const isOwner = !!quiz.creatorId && quiz.creatorId === user.sub;

    const canManage = canManageOwnOrAny({
      isOwner,
      canManageAny: hasPermission(user.role, Permission.QUIZ_VERSION_CREATE_ANY),
      canManageOwn: hasPermission(user.role, Permission.QUIZ_VERSION_CREATE_OWN),
    });

    if (!canManage) {
      throw new QuizForbiddenError('You do not have permission to manage this quiz');
    }
  }

  private async createDraftFromSourceVersion(
    sourceVersion: QuizVersionDetailRow,
    user: JwtPayload,
    payload?: UpdateQuizVersionDto,
  ): Promise<QuizVersionRow> {
    const nowIso = new Date().toISOString();

    try {
      return await this.quizVersionRepository.createDraftFromSourceVersion({
        sourceVersion,
        userId: user.sub,
        payload,
        nowIso,
      });
    } catch (error: unknown) {
      this.mapVersionInsertError(error);
    }
  }

  async createQuizVersion(
    quizId: string,
    user: JwtPayload,
    payload: CreateQuizVersionDto,
  ): Promise<QuizVersionRow> {
    await this.assertQuizManagePermission(quizId, user);

    if (payload.sourceVersionId) {
      const sourceVersion = await this.quizVersionRepository.getQuizVersionDetailById(
        payload.sourceVersionId,
      );

      if (!sourceVersion) {
        throw new QuizNotFoundError('Source version not found');
      }

      if (sourceVersion.quizId !== quizId) {
        throw new QuizValidationError('Invalid source version');
      }

      const isSourceOwner =
        !!sourceVersion.quizCreatorId && sourceVersion.quizCreatorId === user.sub;

      const canUseSourceVersion = canManageOwnOrAny({
        isOwner: isSourceOwner,
        canManageAny: hasPermission(user.role, Permission.QUIZ_VERSION_CREATE_ANY),
        canManageOwn: hasPermission(user.role, Permission.QUIZ_VERSION_CREATE_OWN),
      });

      if (!canUseSourceVersion) {
        throw new QuizForbiddenError('You do not have permission to use this source version');
      }
    }

    const versionNumber = await this.quizVersionRepository.getNextVersionNumber(quizId);
    const nowIso = new Date().toISOString();

    try {
      return await this.quizVersionRepository.createQuizVersion({
        quizId,
        versionNumber,
        difficulty: payload.difficulty,
        durationMs: payload.durationMs,
        passingScorePercent: payload.passingScorePercent,
        rewardXp: payload.rewardXp,
        createdByUserId: user.sub,
        nowIso,
      });
    } catch (error: unknown) {
      this.mapVersionInsertError(error);
    }
  }

  async listQuizVersions(
    quizId: string,
    user: JwtPayload,
    query: ListQuizVersionsQueryDto,
  ): Promise<{
    rows: QuizVersionRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const quiz = await this.quizReadService.getActiveQuizRecordById(quizId);
    const isOwner = !!quiz.creatorId && quiz.creatorId === user.sub;

    const canView = canManageOwnOrAny({
      isOwner,
      canManageAny: hasPermission(user.role, Permission.QUIZ_VERSION_VIEW_ANY),
      canManageOwn: hasPermission(user.role, Permission.QUIZ_VERSION_VIEW_OWN),
    });

    if (!canView) {
      throw new QuizForbiddenError('You do not have permission to view quiz versions');
    }

    const limit = query.limit ?? 10;
    const cursorValue = typeof query.cursor === 'string' ? query.cursor : undefined;
    const cursor = cursorValue ? decodeQuizVersionCursor(cursorValue) : null;

    const rows = await this.quizVersionRepository.listQuizVersions({
      quizId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit,
      hasNextPage,
      nextCursor: hasNextPage && lastItem ? encodeQuizVersionCursor(lastItem) : null,
    };
  }

  async updateQuizVersion(
    quizVersionId: string,
    user: JwtPayload,
    payload: UpdateQuizVersionDto,
  ): Promise<QuizVersionRow> {
    const version = await this.quizVersionRepository.getQuizVersionDetailById(quizVersionId);

    if (!version) {
      throw new QuizNotFoundError('Quiz version not found');
    }

    const isOwner = !!version.quizCreatorId && version.quizCreatorId === user.sub;

    const canEditOwn = hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_OWN);
    const canEditAny = hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_ANY);

    if (version.status === 'archived') {
      throw new QuizVersionImmutableError('Archived versions are immutable and cannot be edited');
    }

    if (version.status === 'published') {
      const canCreateDraft = canManageOwnOrAny({
        isOwner,
        canManageAny: canEditAny,
        canManageOwn: canEditOwn,
      });

      if (!canCreateDraft) {
        throw new QuizForbiddenError(
          'You do not have permission to create a draft from this version',
        );
      }

      return this.createDraftFromSourceVersion(version, user, payload);
    }

    if (
      !canEditQuizVersion({
        status: version.status,
        isOwner,
        canEditAny,
        canEditOwn,
      })
    ) {
      throw new QuizForbiddenError('Only draft versions can be edited');
    }

    const nowIso = new Date().toISOString();

    await this.quizVersionRepository.updateQuizVersion({
      quizVersionId,
      patch: {
        difficulty: payload.difficulty ?? version.difficulty,
        durationMs: payload.durationMs ?? version.durationMs,
        passingScorePercent: payload.passingScorePercent ?? version.passingScorePercent,
        rewardXp: payload.rewardXp ?? version.rewardXp,
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

    if (version.status === 'published') {
      const current = await this.quizVersionRepository.getQuizVersionById(quizVersionId);

      if (!current) {
        throw new QuizNotFoundError('Quiz version not found');
      }

      return current;
    }

    if (version.status === 'archived') {
      throw new QuizVersionImmutableError('Archived versions cannot be published');
    }

    if (version.status !== 'draft') {
      throw new QuizValidationError('Only draft versions can be published');
    }

    const isOwner = !!version.quizCreatorId && version.quizCreatorId === user.sub;

    const canPublish = canPublishQuizVersion({
      status: version.status,
      isOwner,
      canPublishAny: hasPermission(user.role, Permission.QUIZ_VERSION_PUBLISH_ANY),
      canPublishOwn: hasPermission(user.role, Permission.QUIZ_VERSION_PUBLISH_OWN),
      quizIsVerified: version.quizIsVerified,
      quizIsHidden: version.quizIsHidden,
      canVerify: hasPermission(user.role, Permission.QUIZ_VERIFY),
    });

    if (!canPublish) {
      throw new QuizForbiddenError('You do not have permission to publish this quiz version');
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
        throw new QuizNotFoundError('Quiz version not found');
      }

      return current;
    }

    return publishedVersion;
  }
}
