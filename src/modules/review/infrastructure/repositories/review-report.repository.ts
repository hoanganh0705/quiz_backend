import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizReviews, users, quizzes, reviewReports } from '@/core/database/schema';
import type {
  ReviewReportRow,
  ReportedReviewRow,
  PlatformReportRow,
  ReportCursor,
  ReviewReportRepositoryPort,
} from '../../domain/ports/review-report-repository.port';

@Injectable()
export class ReviewReportRepository implements ReviewReportRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async hasUserReportedReview(reviewId: string, reporterId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ reportId: reviewReports.reportId })
      .from(reviewReports)
      .where(and(eq(reviewReports.reviewId, reviewId), eq(reviewReports.reporterId, reporterId)))
      .limit(1);

    return row !== undefined;
  }

  async listReportedReviews(params: {
    reporterId: string;
    limit: number;
    cursor?: ReportCursor | null;
  }): Promise<ReportedReviewRow[]> {
    const cursorCondition = params.cursor
      ? or(
          sql`${reviewReports.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(reviewReports.createdAt, params.cursor.createdAt),
            sql`${reviewReports.reportId} < ${params.cursor.reportId}`,
          ),
        )
      : undefined;

    const rows = await this.db
      .select({
        reportId: reviewReports.reportId,
        reviewId: reviewReports.reviewId,
        quizId: quizReviews.quizId,
        quizTitle: quizzes.title,
        reviewerUsername: users.username,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        createdAt: reviewReports.createdAt,
        updatedAt: reviewReports.updatedAt,
      })
      .from(reviewReports)
      .innerJoin(quizReviews, eq(reviewReports.reviewId, quizReviews.reviewId))
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .where(
        params.cursor
          ? and(eq(reviewReports.reporterId, params.reporterId), cursorCondition)
          : eq(reviewReports.reporterId, params.reporterId),
      )
      .orderBy(desc(reviewReports.createdAt), desc(reviewReports.reportId))
      .limit(params.limit + 1);

    return rows as ReportedReviewRow[];
  }

  async createReport(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
    details: string | null;
    nowIso: string;
  }): Promise<ReviewReportRow> {
    const [report] = await this.db
      .insert(reviewReports)
      .values({
        reviewId: params.reviewId,
        reporterId: params.reporterId,
        reason: params.reason,
        details: params.details,
        status: 'open',
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        reportId: reviewReports.reportId,
        reviewId: reviewReports.reviewId,
        reporterId: reviewReports.reporterId,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        createdAt: reviewReports.createdAt,
        updatedAt: reviewReports.updatedAt,
      });

    return report as ReviewReportRow;
  }

  async listPlatformReports(params: {
    limit: number;
    cursor?: { createdAt: string; reportId: string } | null;
    status?: 'open' | 'reviewed' | 'dismissed' | 'actioned' | null;
  }): Promise<PlatformReportRow[]> {
    const cursorCondition = params.cursor
      ? or(
          sql`${reviewReports.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(reviewReports.createdAt, params.cursor.createdAt),
            sql`${reviewReports.reportId} < ${params.cursor.reportId}`,
          ),
        )
      : undefined;

    const whereClauses = params.cursor ? [cursorCondition!] : [];
    if (params.status) {
      whereClauses.push(eq(reviewReports.status, params.status));
    }

    const rows = await this.db
      .select({
        reportId: reviewReports.reportId,
        reviewId: reviewReports.reviewId,
        quizId: quizReviews.quizId,
        quizTitle: quizzes.title,
        reviewerUsername: users.username,
        reportedUserId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        createdAt: reviewReports.createdAt,
        updatedAt: reviewReports.updatedAt,
      })
      .from(reviewReports)
      .innerJoin(quizReviews, eq(reviewReports.reviewId, quizReviews.reviewId))
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
      .orderBy(desc(reviewReports.createdAt), desc(reviewReports.reportId))
      .limit(params.limit + 1);

    return rows as unknown as PlatformReportRow[];
  }

  async updateReportStatus(params: {
    reportId: string;
    status: 'reviewed' | 'dismissed' | 'actioned';
    nowIso: string;
  }): Promise<void> {
    await this.db
      .update(reviewReports)
      .set({ status: params.status, updatedAt: params.nowIso })
      .where(eq(reviewReports.reportId, params.reportId));
  }
}
