import { Inject, Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CreateQuizDto } from '../../dto/request/create-quiz.dto';
import { UpdateQuizDto } from '../../dto/request/update-quiz.dto';
import { buildSlug } from '@/common/utils/slug.util';
import { normalizeNullableText } from '@/common/utils/text.util';
import { hasOwn } from '@/common/utils/object.util';
import { QuizReadService } from './quiz-read.service';
import { QUIZ_SLUG_CONFLICT_MESSAGE, QUIZ_LINK_IDS_INVALID_MESSAGE } from '../../quiz.constants';
import { normalizeLinkIds, normalizeQuizSlug } from '../shared/quiz-utils';
import {
  QUIZ_REPOSITORY_PORT,
  type QuizRepositoryPort,
  type QuizWithPublishedVersionRow,
} from '../ports/quiz-repository.port';
import {
  QuizForbiddenError,
  QuizConflictError,
  QuizValidationError,
  QuizDomainError,
} from '../errors';
import { InjectPinoLogger } from 'nestjs-pino/InjectPinoLogger';
import { PinoLogger } from 'nestjs-pino/PinoLogger';
@Injectable()
export class QuizWriteService {
  constructor(
    @Inject(QUIZ_REPOSITORY_PORT) private readonly quizRepository: QuizRepositoryPort,
    private readonly quizReadService: QuizReadService,
    @InjectPinoLogger(QuizWriteService.name) private readonly logger: PinoLogger,
  ) {}

  private assertQuizOwnerOrAdmin(quizCreatorId: string | null, user: JwtPayload): void {
    const isOwner = !!quizCreatorId && quizCreatorId === user.sub;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new QuizForbiddenError('You do not have permission to manage this quiz');
    }
  }

  private mapQuizCreateError(error: unknown): never {
    const maybePgError = error as { code?: string; constraint?: string };

    if (maybePgError.code === '23505') {
      throw new QuizConflictError(QUIZ_SLUG_CONFLICT_MESSAGE);
    }

    if (maybePgError.code === '23503') {
      throw new QuizValidationError(QUIZ_LINK_IDS_INVALID_MESSAGE);
    }

    throw new QuizDomainError('Quiz operation failed');
  }

  private mapQuizUpdateError(error: unknown): never {
    const maybePgError = error as { code?: string };

    if (maybePgError.code === '23505') {
      throw new QuizConflictError(QUIZ_SLUG_CONFLICT_MESSAGE);
    }

    if (maybePgError.code === '23503') {
      throw new QuizValidationError(QUIZ_LINK_IDS_INVALID_MESSAGE);
    }

    throw new QuizDomainError('Quiz operation failed');
  }

  async createQuiz(user: JwtPayload, payload: CreateQuizDto): Promise<QuizWithPublishedVersionRow> {
    const title = payload.title.trim();
    const slug = normalizeQuizSlug(payload.slug ?? buildSlug(title));
    const description = normalizeNullableText(payload.description) ?? null;
    const requirements = normalizeNullableText(payload.requirements) ?? null;
    const imageUrl = normalizeNullableText(payload.imageUrl) ?? null;
    const categoryIds = normalizeLinkIds(payload.categoryIds);
    const tagIds = normalizeLinkIds(payload.tagIds);
    const nowIso = new Date().toISOString();

    let createdQuizId = '';

    try {
      const createdQuiz = await this.quizRepository.createQuizWithInitialVersion({
        creatorId: user.sub,
        title,
        slug,
        description,
        requirements,
        imageUrl,
        isFeatured: payload.isFeatured ?? false,
        isHidden: payload.isHidden ?? false,
        initialVersion: payload.initialVersion,
        categoryIds,
        tagIds,
        nowIso,
      });

      createdQuizId = createdQuiz.quizId;
    } catch (error: unknown) {
      this.logger.error({
        event: 'quiz_create_failed',
        userId: user.sub,
        errorCode: (error as { code?: string })?.code ?? 'UNKNOWN',
      });
      this.mapQuizCreateError(error);
    }

    return this.quizReadService.getQuizById(createdQuizId);
  }

  async updateQuiz(
    quizId: string,
    user: JwtPayload,
    payload: UpdateQuizDto,
  ): Promise<QuizWithPublishedVersionRow> {
    const quiz = await this.quizReadService.getActiveQuizRecordById(quizId);
    this.assertQuizOwnerOrAdmin(quiz.creatorId, user);

    const patch: Partial<{
      title: string;
      description: string | null;
      slug: string;
      requirements: string | null;
      imageUrl: string | null;
      isFeatured: boolean;
      isHidden: boolean;
    }> = {};

    if (hasOwn(payload, 'title') && payload.title !== undefined) {
      patch.title = payload.title.trim();
    }

    if (hasOwn(payload, 'description')) {
      patch.description = normalizeNullableText(payload.description);
    }

    if (hasOwn(payload, 'slug') && payload.slug !== undefined) {
      patch.slug = normalizeQuizSlug(payload.slug);
    }

    if (hasOwn(payload, 'requirements')) {
      patch.requirements = normalizeNullableText(payload.requirements);
    }

    if (hasOwn(payload, 'imageUrl')) {
      patch.imageUrl = normalizeNullableText(payload.imageUrl);
    }

    if (hasOwn(payload, 'isFeatured') && payload.isFeatured !== undefined) {
      patch.isFeatured = payload.isFeatured;
    }

    if (hasOwn(payload, 'isHidden') && payload.isHidden !== undefined) {
      patch.isHidden = payload.isHidden;
    }

    const hasCategoryIds = hasOwn(payload, 'categoryIds');
    const hasTagIds = hasOwn(payload, 'tagIds');

    const categoryIds = hasCategoryIds ? normalizeLinkIds(payload.categoryIds) : null;
    const tagIds = hasTagIds ? normalizeLinkIds(payload.tagIds) : null;

    if (Object.keys(patch).length === 0 && !hasCategoryIds && !hasTagIds) {
      return this.quizReadService.getQuizById(quizId);
    }

    const nowIso = new Date().toISOString();

    try {
      await this.quizRepository.updateQuizWithLinks({
        quizId,
        patch,
        categoryIds,
        tagIds,
        nowIso,
      });
    } catch (error: unknown) {
      this.mapQuizUpdateError(error);
    }

    return this.quizReadService.getQuizById(quizId);
  }

  async softDeleteQuizById(quizId: string, user: JwtPayload): Promise<{ message: string }> {
    const quiz = await this.quizReadService.getActiveQuizRecordById(quizId);
    this.assertQuizOwnerOrAdmin(quiz.creatorId, user);

    const nowIso = new Date().toISOString();

    await this.quizRepository.softDeleteQuiz(quizId, nowIso);

    return { message: 'Quiz deleted successfully' };
  }
}
