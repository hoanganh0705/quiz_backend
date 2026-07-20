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

export type PlatformReportItem = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  reportedUserId: string;
  rating: number;
  comment: string | null;
  // Phase 5 / Issue #18 — narrowed to the closed-set type so the
  // mapper can pass it directly into the response DTO without a
  // cast. The DB stores it as `text`, and the repository returns
  // it as `string`; the `as` cast happens once in the repo and
  // the value carries the structured type from there.
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
    private readonly auditLogService: AuditLogService,
    @InjectPinoLogger(ReviewAdminService.name)
    private readonly logger: PinoLogger,
  ) {}

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

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, reportId: lastItem.reportId }
          : null,
    };
  }

  async updateReportStatus(
    reportId: string,
    status: 'reviewed' | 'dismissed' | 'actioned',
    actorId: string,
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    // Phase 2 / Issue #38 — load the current status first so we can
    // evaluate the state machine BEFORE attempting the UPDATE. If
    // the report does not exist, surface a 404 (`ReviewReportNotFoundError`).
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

    // Phase 5 / Issue #37 — wrap the status UPDATE and the
    // audit-row INSERT in one DB transaction so they commit
    // atomically. The previous shape wrote the status UPDATE
    // first and then `try { await auditLog.record(...) }`-ed
    // the audit row outside any transaction; either side could
    // fail independently and leave the moderator action
    // unaudited. With a shared transaction: if the audit row
    // raises, the status UPDATE rolls back; if the status
    // UPDATE loses the race, the audit row is never persisted.
    // The compare-and-set remains the gate for concurrent
    // moderators — only one tx commits.
    //
    // Phase 5 / Issue #39 — when the transition is `actioned`,
    // the same transaction also soft-deletes the offending
    // review (so the public surface stops showing it
    // immediately), schedules an analytics-refresh outbox
    // event (so `quiz_reviews.helpful_count` /
    // `average_rating` / `rating_count` denormalized counters
    // re-converge), and audits the moderator action with both
    // the previous status and the actioned outcome. All four
    // writes commit or roll back together.
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

          // Fetch the actioned review's quiz id so the
          // outbox event carries the right `quizId` for the
          // analytics refresh job. We could carry just the
          // `reviewId` and have the worker JOIN the soft-
          // deleted row, but `quiz_reviews` filters out
          // soft-deleted rows in the active predicate. The
          // outbox payload therefore needs `quizId`
          // captured at action time.
          const quizId = await this.reviewRepository.getQuizIdByReviewIdInTx(actionedReviewId, tx);

          actionedQuizId = quizId;

          if (quizId) {
            // Issue #3 — schedule analytics refresh so the
            // denormalized counters drop the actioned
            // review's contribution. Without this, the
            // dashboard would continue to show stale
            // `helpful_count` / average rating until the
            // next reconciliation cron tick.
            await this.reviewOutbox.scheduleReviewDeleted(
              { quizId, reviewId: actionedReviewId },
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
          // Phase 5 / Issue #39 — record whether the
          // transition also soft-deleted a review and, if
          // so, which one. The audit row is the only
          // durable record of the actioned outcome once
          // the review becomes invisible everywhere else.
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
      // Lost the race to a concurrent moderator. Surface the same
      // 409 a UI client would see if the row was already in a
      // terminal state.
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

    // Phase 5 / Issue #39 — when the transition is `actioned`
    // and the offending review was successfully soft-deleted,
    // dispatch the in-memory `ReviewDeletedEvent` so any
    // in-process subscribers (e.g. the quiz dashboard's
    // real-time updates) reflect the moderator action without
    // waiting for the outbox worker to drain.
    if (status === 'actioned' && actionedReviewId && actionedQuizId) {
      this.reviewEventBus.dispatchToSubscribers(
        new ReviewDeletedEvent({ quizId: actionedQuizId, reviewId: actionedReviewId }),
      );
    }
  }

  /**
   * Admin-grade review removal.
   *
   * Phase 1 / Issue #22 — `DELETE /quizzes/:quizId/reviews` is keyed on
   * `(quizId, user.sub)`, which makes the `actor.role === 'admin'` branch
   * of `ReviewAuthorizationPolicy.canModify` unreachable: an admin cannot
   * delete another user's review through the self-delete endpoint.
   *
   * This method deletes any review by id. Authorization is enforced by the
   * route-level `Permissions(REVIEW_MODERATE)` guard; the policy layer is
   * the source of truth and the audit log is also written here for a
   * durable record of the moderation action.
   */
  async adminDeleteReview(reviewId: string, actorId: string): Promise<void> {
    const existing = await this.reviewRepository.getReviewById(reviewId);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const nowIso = new Date().toISOString();
    let didSoftDelete = false;

    await this.db.transaction(async (tx) => {
      // Phase 5 / Issue #17 — soft-delete instead of hard-delete
      // so the helpful-vote rows survive. The repository filters
      // every public read by `deleted_at IS NULL`, so the row is
      // invisible to clients and the audit log still has the
      // moderator action recorded.
      didSoftDelete = await this.reviewRepository.softDeleteReview(reviewId, nowIso);

      if (!didSoftDelete) {
        // Already soft-deleted — keep the operation idempotent.
        return;
      }

      // Phase 1 / Issue #3 — atomic outbox schedule. Mirrors the
      // self-delete path so a moderator removal also refreshes the
      // denormalized counters consistently.
      await this.reviewOutbox.scheduleReviewDeleted(
        { quizId: existing.quizId, reviewId },
        tx,
        nowIso,
      );

      // Phase 5 / Issue #39 — record the audit row inside the
      // same transaction. The previous shape called
      // `auditLogService.record` AFTER the transaction committed
      // so the moderator action could land in the DB without an
      // audit row, leaving a window where the action was
      // unaudited. With the tx-scoped executor: if the audit
      // INSERT raises, the soft-delete and outbox schedule both
      // roll back; if the soft-delete fails, the audit row is
      // never written.
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

    if (!didSoftDelete) {
      // Already soft-deleted — idempotent success, no event, no log.
      return;
    }

    this.logger.info({
      event: 'review_admin_deleted',
      reviewId,
      quizId: existing.quizId,
      actorId,
    });

    this.reviewEventBus.dispatchToSubscribers(
      new ReviewDeletedEvent({ quizId: existing.quizId, reviewId }),
    );
  }
}
