import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';
import { AuditLogService } from '@/common/audit/audit-log.service';

export type PlatformReportItem = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  reportedUserId: string;
  rating: number;
  comment: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ReviewAdminService {
  constructor(
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviewRepository: ReviewRepositoryPort,
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

    const rows = await this.reviewRepository.listPlatformReports({
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
    await this.reviewRepository.updateReportStatus({
      reportId,
      status,
      nowIso,
    });

    this.logger.info({ event: 'review_admin_report_status_updated', reportId, status, actorId });

    // Audit: review moderation. The previous code only logged
    // the action, which is not durable and cannot be queried
    // later. The cross-domain audit log captures who acted on
    // which report so the platform can answer "which reports
    // did admin X dismiss this week?" without grepping logs.
    try {
      await this.auditLogService.record({
        eventType: 'review.report.status_changed',
        domain: 'review',
        action: 'report.status_changed',
        actorId,
        metadata: {
          reportId,
          newStatus: status,
        },
        createdAt: nowIso,
      });
    } catch (error) {
      this.logger.error({
        event: 'review_admin_report_status_audit_write_failed',
        reportId,
        status,
        actorId,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
