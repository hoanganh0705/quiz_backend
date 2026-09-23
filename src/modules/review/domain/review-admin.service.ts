import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { DrizzleDB } from '@/core/database/database.module';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import {
  REVIEW_REPORT_REPOSITORY_PORT,
  type ReviewReportRepositoryPort,
} from './ports/review-report-repository.port';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';
import { REVIEW_OUTBOX_PORT, type ReviewOutboxPort } from './ports/review-outbox.port';
import { REVIEW_DOMAIN_EVENT_BUS, type ReviewDomainEventBusPort } from './events';
import { ReviewDeletedEvent } from './events';
import {
  ReviewReportInvalidTransitionError,
  ReviewReportNotFoundError,
  ReviewNotFoundError,
} from './errors';
import { REVIEW_NOT_FOUND_MESSAGE } from '../review.constants';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { ReviewReportStatusPolicy } from './policies/review-report-status.policy';
import { sliceWithCursor } from '../application/cursor-pagination.helper';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';

export type PlatformReportItem = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  reportedUserId: string;
  rating: number;
  comment: string | null;

  reason: import('./policies/review-report-status.policy').ReviewReportReason;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ReviewAdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviewRepository: ReviewRepositoryPort,
    @Inject(REVIEW_REPORT_REPOSITORY_PORT)
    private readonly reportRepository: ReviewReportRepositoryPort,
    @Inject(REVIEW_DOMAIN_EVENT_BUS)
    private readonly reviewEventBus: ReviewDomainEventBusPort,
    @Inject(REVIEW_OUTBOX_PORT)
    private readonly reviewOutbox: ReviewOutboxPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getQuizWithPublishedVersionById: (quizId: string) => Promise<{
        quizId: string;
        title: string;
        creatorId: string | null;
      } | null>;
    },
    private readonly auditLogService: AuditLogService,
    @InjectPinoLogger(ReviewAdminService.name)
    private readonly logger: PinoLogger,
  ) {}

  private async snapshotQuizMetadata(
    quizId: string,
  ): Promise<{ quizTitle: string; quizCreatorId: string }> {
    const quiz = await this.quizRepository.getQuizWithPublishedVersionById(quizId);
    return {
      quizTitle: quiz?.title ?? '',
      quizCreatorId: quiz?.creatorId ?? '',
    };
  }

  async listPlatformReports(params: {
    limit: number;
    cursor?: { createdAt: string; reportId: string } | null;
    status?: 'open' | 'reviewed' | 'dismissed' | 'actioned' | null;
  }): Promise<{
    items: PlatformReportItem[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reportId: string } | null;
  }> {
    const limit = params.limit ?? 20;
    const cursor = params.cursor ?? null;

    const rows = await this.reportRepository.listPlatformReports({
      limit,
      cursor,
      status: params.status,
    });

    const { items, hasNextPage, nextCursor } = sliceWithCursor(rows, limit, (row) => ({
      createdAt: row.createdAt,
      reportId: row.reportId,
    }));

    return {
      items,
      limit,
      hasNextPage,
      nextCursor: nextCursor as { createdAt: string; reportId: string } | null,
    };
  }

  async updateReportStatus(
    reportId: string,
    status: 'reviewed' | 'dismissed' | 'actioned',
    actorId: string,
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    const currentStatus = await this.reportRepository.getReportStatus(reportId);

    if (currentStatus === null) {
      this.logger.warn({ event: 'review_admin_report_not_found', reportId, actorId });
      throw new ReviewReportNotFoundError();
    }

    if (!ReviewReportStatusPolicy.canTransition(currentStatus, status)) {
      this.logger.warn({
        event: 'review_admin_report_invalid_transition',
        reportId,
        currentStatus,
        attemptedStatus: status,
        actorId,
      });
      throw new ReviewReportInvalidTransitionError();
    }

    const result = await this.db.transaction(async (tx) => {
      const didUpdate = await this.reportRepository.updateReportStatusIfCurrent({
        reportId,
        currentStatus,
        newStatus: status,
        nowIso,
        tx,
      });

      if (!didUpdate) {
        return {
          updated: false,
          actionedReviewId: null as string | null,
          actionedQuizId: null as string | null,
        };
      }

      let actionedReviewId: string | null = null;
      let actionedQuizId: string | null = null;

      if (status === 'actioned') {
        actionedReviewId = await this.reportRepository.getReportReviewId(reportId, tx);

        if (actionedReviewId) {
          await this.reviewRepository.softDeleteReviewInTx(actionedReviewId, nowIso, tx);

          const quizId = await this.reviewRepository.getQuizIdByReviewIdInTx(actionedReviewId, tx);

          actionedQuizId = quizId;

          if (quizId) {
            const snapshot = await this.snapshotQuizMetadata(quizId);

            await this.reviewOutbox.scheduleReviewDeleted(
              {
                quizId,
                quizTitle: snapshot.quizTitle,
                quizCreatorId: snapshot.quizCreatorId,
                reviewId: actionedReviewId,
              },
              tx,
              nowIso,
            );
          }
        }
      }

      await this.auditLogService.recordWithExecutor(tx, {
        eventType: 'review.report.status_changed',
        domain: 'review',
        action: 'report.status_changed',
        actorId,
        metadata: {
          reportId,
          previousStatus: currentStatus,
          newStatus: status,
          ...(actionedReviewId ? { actionedReviewId } : {}),
        },
        createdAt: nowIso,
      });

      return {
        updated: true as const,
        actionedReviewId: actionedReviewId,
        actionedQuizId: actionedQuizId,
      };
    });

    const updated = result.updated;
    const actionedReviewId = result.actionedReviewId;
    const actionedQuizId = result.actionedQuizId;

    if (!updated) {
      this.logger.warn({
        event: 'review_admin_report_invalid_transition_race',
        reportId,
        expectedStatus: currentStatus,
        attemptedStatus: status,
        actorId,
      });
      throw new ReviewReportInvalidTransitionError();
    }

    this.logger.info({ event: 'review_admin_report_status_updated', reportId, status, actorId });

    if (status === 'actioned' && actionedReviewId && actionedQuizId) {
      const snapshot = await this.snapshotQuizMetadata(actionedQuizId);
      this.reviewEventBus.dispatchToSubscribers(
        new ReviewDeletedEvent({
          quizId: actionedQuizId,
          quizTitle: snapshot.quizTitle,
          quizCreatorId: snapshot.quizCreatorId,
          reviewId: actionedReviewId,
        }),
      );
    }
  }

  async adminDeleteReview(reviewId: string, actorId: string): Promise<void> {
    const existing = await this.reviewRepository.getReviewById(reviewId);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const nowIso = new Date().toISOString();
    let didSoftDelete = false;

    await this.db.transaction(async (tx) => {
      didSoftDelete = await this.reviewRepository.softDeleteReviewInTx(
        reviewId,
        nowIso,
        tx as unknown,
      );

      if (!didSoftDelete) {
        throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
      }

      const snapshot = await this.snapshotQuizMetadata(existing.quizId);

      await this.reviewOutbox.scheduleReviewDeleted(
        {
          quizId: existing.quizId,
          quizTitle: snapshot.quizTitle,
          quizCreatorId: snapshot.quizCreatorId,
          reviewId,
        },
        tx,
        nowIso,
      );

      await this.auditLogService.recordWithExecutor(tx, {
        eventType: 'review.admin.deleted',
        domain: 'review',
        action: 'review.admin_deleted',
        actorId,
        metadata: {
          reviewId,
          quizId: existing.quizId,
          authorId: existing.userId,
        },
        createdAt: nowIso,
      });
    });

    this.logger.info({
      event: 'review_admin_deleted',
      reviewId,
      quizId: existing.quizId,
      actorId,
    });

    const snapshot = await this.snapshotQuizMetadata(existing.quizId);
    this.reviewEventBus.dispatchToSubscribers(
      new ReviewDeletedEvent({
        quizId: existing.quizId,
        quizTitle: snapshot.quizTitle,
        quizCreatorId: snapshot.quizCreatorId,
        reviewId,
      }),
    );
  }
}
