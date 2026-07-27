/**
 * Comment Module
 *
 * Owns the per-quiz comment surface (top-level comments + one-level replies),
 * votes, moderation reports, and the audit log for moderator actions.
 *
 * Layering:
 *   - `domain/`     — pure business rules, ports, events, errors.
 *   - `application/` — orchestrates the domain service with cursor
 *                      (de)serialization, JWT wiring, and audit logs.
 *   - `infrastructure/` — Drizzle repository, cross-module adapters,
 *                         audit, scheduler.
 *   - `transport/` — controllers and presenter only.
 *
 * Exports the bus and the application service so cross-module
 * listeners can subscribe (Notification) and cross-module callers
 * can read (none today, but kept on principle).
 */

import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { RedisModule } from '@/core/redis/redis.module';
import { CommonModule } from '@/common/common.module';

import { CommentApplicationService } from './application/comment-application.service';
import { CommentService } from './domain/services/comment.service';
import { CommentDomainEventBus } from './domain/events/comment-event-bus';
import { CommentRepository } from './infrastructure/repositories/comment.repository';
import { CommentModeratorAuditService } from './infrastructure/audit/comment-moderator-audit.service';
import { CommentCounterReconcilerService } from './infrastructure/scheduler/comment-counter-reconciler.service';
import { QuizExistenceAdapter } from './infrastructure/adapters/quiz-existence.adapter';
import { UserExistenceAdapter } from './infrastructure/adapters/user-existence.adapter';
import { CommentController } from './transport/controller/comment.controller';
import { QuizCommentController } from './transport/controller/quiz-comment.controller';
import { UserCommentController } from './transport/controller/user-comment.controller';
import { ReportController } from './transport/controller/report.controller';
import { CommentPresenter } from './transport/presenters/comment.presenter';

import { COMMENT_REPOSITORY_PORT, QUIZ_EXISTENCE_PORT, USER_EXISTENCE_PORT } from './domain/ports';
import { COMMENT_DOMAIN_EVENT_BUS } from './domain/events';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    CommonModule,
    forwardRef(() => QuizModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    // Application
    CommentApplicationService,
    // Domain
    CommentService,
    {
      provide: COMMENT_DOMAIN_EVENT_BUS,
      useExisting: CommentDomainEventBus,
    },
    CommentDomainEventBus,
    // Infrastructure
    CommentRepository,
    {
      provide: COMMENT_REPOSITORY_PORT,
      useExisting: CommentRepository,
    },
    CommentModeratorAuditService,
    CommentCounterReconcilerService,
    QuizExistenceAdapter,
    {
      provide: QUIZ_EXISTENCE_PORT,
      useExisting: QuizExistenceAdapter,
    },
    UserExistenceAdapter,
    {
      provide: USER_EXISTENCE_PORT,
      useExisting: UserExistenceAdapter,
    },
    // Transport
    CommentPresenter,
  ],
  controllers: [CommentController, QuizCommentController, UserCommentController, ReportController],
  exports: [
    CommentApplicationService,
    COMMENT_DOMAIN_EVENT_BUS,
    CommentDomainEventBus,
    CommentModeratorAuditService,
    QUIZ_EXISTENCE_PORT,
    USER_EXISTENCE_PORT,
  ],
})
export class CommentModule {}
