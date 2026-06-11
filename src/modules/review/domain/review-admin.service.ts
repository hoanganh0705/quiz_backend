import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';

export type PlatformReportItem = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  reportedUserId: string;
  rating: number;
  content: string | null;
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
  ): Promise<void> {
    await this.reviewRepository.updateReportStatus({
      reportId,
      status,
      nowIso: new Date().toISOString(),
    });

    this.logger.info({ event: 'review_admin_report_status_updated', reportId, status });
  }
}
