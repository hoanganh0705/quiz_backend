import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { buildSlug } from '@/common/utils/slug.util';
import { normalizeNullableText } from '@/common/utils/text.util';
import { hasOwn } from '@/common/utils/object.util';
import { QuizQueryService } from './quiz-query.service';
import { normalizeLinkIds } from '../links/quiz-link-ids';
import { normalizeQuizSlug } from '../slug/quiz-slug';
import { QuizPolicy } from '../policies/quiz.policy';
import { QuizDomainEventBus } from '../events/quiz-domain.event-bus';
import { QuizCreatedEvent, QuizUpdatedEvent, QuizDeletedEvent } from '../events/quiz-domain.events';
import type { CreateQuizCommand, UpdateQuizCommand } from '../types';
import {
  QUIZ_REPOSITORY_PORT,
  type QuizRepositoryPort,
  type QuizWithPublishedVersionRow,
} from '../ports/quiz-repository.port';
import { QUIZ_DOMAIN_EVENT_BUS } from '../ports/quiz-domain-event-bus.port';
import { AuditLogService } from '@/common/audit/audit-log.service';

/**
 * QuizCommandService — Command orchestration for the Quiz aggregate.
 *
 * Responsibilities:
 *  - Create, update, and soft-delete quizzes
 *  - Enforce ownership and authorization rules for mutating operations
 *  - Normalize and validate input before persisting
 *  - Emit domain events for downstream consumers
 *
 * Never returns raw repository rows — always fetches fresh state via QuizQueryService.
 */
@Injectable()
export class QuizCommandService {
  constructor(
    @Inject(QUIZ_REPOSITORY_PORT) private readonly quizRepository: QuizRepositoryPort,
    private readonly quizQueryService: QuizQueryService,
    @Inject(QUIZ_DOMAIN_EVENT_BUS) private readonly eventBus: QuizDomainEventBus,
    private readonly auditLogService: AuditLogService,
    @InjectPinoLogger(QuizCommandService.name) private readonly logger: PinoLogger,
  ) {}

  private refetchQuiz(quizId: string): Promise<QuizWithPublishedVersionRow> {
    return this.quizQueryService.getQuizById(quizId);
  }

  async createQuiz(
    user: JwtPayload,
    command: CreateQuizCommand,
  ): Promise<QuizWithPublishedVersionRow> {
    QuizPolicy.assertCanCreate(user);

    const title = command.title.trim();
    const slug = command.slug ?? buildSlug(title);
    const normalizedSlug = normalizeQuizSlug(slug);
    const description = normalizeNullableText(command.description) ?? null;
    const requirements = normalizeNullableText(command.requirements) ?? null;
    const imageUrl = normalizeNullableText(command.imageUrl) ?? null;
    const categoryIds = normalizeLinkIds(command.categoryIds);
    const tagIds = normalizeLinkIds(command.tagIds);
    const nowIso = new Date().toISOString();

    const { quizId } = await this.quizRepository.createQuizWithInitialVersion({
      creatorId: command.creatorId,
      title,
      slug: normalizedSlug,
      description,
      requirements,
      imageUrl,
      isFeatured: command.isFeatured,
      isHidden: command.isHidden,
      initialVersion: command.initialVersion,
      categoryIds,
      tagIds,
      nowIso,
    });

    this.logger.info({ event: 'quiz_created', quizId, userId: user.sub });

    this.eventBus.emitQuizCreated(new QuizCreatedEvent(quizId, user.sub, normalizedSlug, nowIso));

    return this.refetchQuiz(quizId);
  }

  async updateQuiz(
    quizId: string,
    user: JwtPayload,
    command: UpdateQuizCommand,
  ): Promise<QuizWithPublishedVersionRow> {
    const quiz = await this.quizQueryService.getActiveQuizRecordById(quizId);
    QuizPolicy.assertCanEdit(quiz.creatorId, user);

    const patch: Partial<{
      title: string;
      description: string | null;
      slug: string;
      requirements: string | null;
      imageUrl: string | null;
      isFeatured: boolean;
      isHidden: boolean;
    }> = {};

    if (hasOwn(command, 'title') && command.title !== undefined) {
      patch.title = command.title.trim();
    }

    if (hasOwn(command, 'description')) {
      patch.description = normalizeNullableText(command.description);
    }

    if (hasOwn(command, 'slug') && command.slug !== undefined) {
      patch.slug = normalizeQuizSlug(command.slug);
    }

    if (hasOwn(command, 'requirements')) {
      patch.requirements = normalizeNullableText(command.requirements);
    }

    if (hasOwn(command, 'imageUrl')) {
      patch.imageUrl = normalizeNullableText(command.imageUrl);
    }

    if (hasOwn(command, 'isFeatured') && command.isFeatured !== undefined) {
      patch.isFeatured = command.isFeatured;
    }

    if (hasOwn(command, 'isHidden') && command.isHidden !== undefined) {
      patch.isHidden = command.isHidden;
    }

    const hasCategoryIds = hasOwn(command, 'categoryIds');
    const hasTagIds = hasOwn(command, 'tagIds');

    const categoryIds = hasCategoryIds ? normalizeLinkIds(command.categoryIds ?? undefined) : null;
    const tagIds = hasTagIds ? normalizeLinkIds(command.tagIds ?? undefined) : null;

    if (Object.keys(patch).length === 0 && !hasCategoryIds && !hasTagIds) {
      return this.refetchQuiz(quizId);
    }

    const nowIso = new Date().toISOString();

    await this.quizRepository.updateQuizWithLinks({
      quizId,
      patch,
      categoryIds,
      tagIds,
      nowIso,
    });

    this.logger.info({ event: 'quiz_updated', quizId, userId: user.sub });

    this.eventBus.emitQuizUpdated(new QuizUpdatedEvent(quizId, user.sub, nowIso));

    return this.refetchQuiz(quizId);
  }

  async softDeleteQuizById(quizId: string, user: JwtPayload): Promise<{ message: string }> {
    const quiz = await this.quizQueryService.getActiveQuizRecordById(quizId);
    QuizPolicy.assertCanDelete(quiz.creatorId, user);

    const nowIso = new Date().toISOString();

    await this.quizRepository.softDeleteQuiz(quizId, nowIso);

    this.logger.info({ event: 'quiz_deleted', quizId, userId: user.sub });

    // Audit: quiz deletion is destructive. The previous
    // implementation only logged the event; the cross-domain
    // audit log captures who deleted which quiz so the
    // platform can answer "did creator X delete their own
    // quiz or did an admin do it?" and so the analytics
    // module can attribute the loss of attempts to a known
    // user action.
    try {
      await this.auditLogService.record({
        eventType: 'quiz.deleted',
        domain: 'quiz',
        action: 'quiz.deleted',
        actorId: user.sub,
        metadata: {
          quizId,
          creatorId: quiz.creatorId,
          wasAdminOverride: quiz.creatorId !== user.sub,
        },
        createdAt: nowIso,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_deletion_audit_write_failed',
        quizId,
        userId: user.sub,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    this.eventBus.emitQuizDeleted(new QuizDeletedEvent(quizId, user.sub, nowIso));

    return { message: 'Quiz deleted successfully' };
  }
}
