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
import { ReviewAlreadyReportedError } from '../../domain/errors';

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
    status?: import('../../domain/policies/review-report-status.policy').ReviewReportStatus | null;
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

    // Phase 3 / Issue #7 — apply the optional status filter at the
    // repository boundary so the SQL query stays a single round-trip
    // and an empty filter passes through unchanged. Building the
    // predicate incrementally keeps the SQL planner happy: an
    // optional `eq(reviewReports.status, ...)` is the same query
    // shape with or without the filter.
    const filterConditions: Array<ReturnType<typeof eq>> = [];
    filterConditions.push(eq(reviewReports.reporterId, params.reporterId));
    if (params.status) {
      filterConditions.push(eq(reviewReports.status, params.status));
    }
    if (cursorCondition) {
      filterConditions.push(cursorCondition);
    }
    const whereCondition =
      filterConditions.length === 1 ? filterConditions[0] : and(...filterConditions);

    // Phase 4 / Issue #35 — switch the joins against `quiz_reviews`,
    // `quizzes`, and `users` from INNER to LEFT so the user's
    // "my reported reviews" list survives deletion of the underlying
    // review. The previous INNER-JOIN shape silently dropped every
    // report whose target review had been cascade-deleted, which left
    // users wondering whether their report was lost. Today the FK is
    // `ON DELETE CASCADE`, so the review row is gone and the
    // user-visible columns (`quizTitle`, `rating`, `comment`,
    // `reviewerUsername`) are null — the response DTOs already mark
    // them nullable. The report itself (`status`, `reason`,
    // `details`, timestamps) is the source of truth and is preserved.
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
      .leftJoin(quizReviews, eq(reviewReports.reviewId, quizReviews.reviewId))
      .leftJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .leftJoin(users, eq(quizReviews.userId, users.userId))
      .where(whereCondition)
      .orderBy(desc(reviewReports.createdAt), desc(reviewReports.reportId))
      .limit(params.limit + 1);

    // Phase 5 / Issue #18 — narrow `reason` from `text` to
    // the closed-set tag. Cast happens once here; downstream
    // consumers carry the structured tag.
    return rows as unknown as ReportedReviewRow[];
  }

  async createReport(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
    details: string | null;
    nowIso: string;
  }): Promise<ReviewReportRow> {
    try {
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

      // Phase 5 / Issue #18 — the DTO layer validates the
      // closed set of reason tags, so the value stored by
      // `createReport` always satisfies `ReviewReportReason`.
      // The `as unknown as` is a deliberate single boundary
      // cast; downstream consumers carry the structured tag.
      return report as unknown as ReviewReportRow;
    } catch (error) {
      // Phase 2 / Issue #6 — concurrent duplicate reports race past
      // `hasUserReportedReview` and both call `createReport`. The
      // unique index `uq_review_reports_review_reporter` catches the
      // second insert. Translate the Postgres 23505 into the
      // application-level `ReviewAlreadyReportedError` so the caller
      // sees a clean 409 instead of a 500.
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_review_reports_review_reporter') {
        throw new ReviewAlreadyReportedError();
      }
      throw error;
    }
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

  async getReportStatus(reportId: string): Promise<ReviewReportRow['status'] | null> {
    const [row] = await this.db
      .select({ status: reviewReports.status })
      .from(reviewReports)
      .where(eq(reviewReports.reportId, reportId))
      .limit(1);
    return (row?.status ?? null) as ReviewReportRow['status'] | null;
  }

  async updateReportStatusIfCurrent(params: {
    reportId: string;
    currentStatus: ReviewReportRow['status'];
    newStatus: 'reviewed' | 'dismissed' | 'actioned';
    nowIso: string;
    tx?: unknown;
  }): Promise<boolean> {
    // Phase 2 / Issue #38 — atomic compare-and-set on the status
    // column. The WHERE clause pins both the report id AND the
    // current status, so a concurrent moderator cannot flip the row
    // through a different transition while this UPDATE is in flight.
    // Returns true iff a row was updated (i.e. the precondition held
    // at the moment the UPDATE ran). The admin service maps a `false`
    // return to either a not-found or an invalid-transition response
    // based on a follow-up `getReportStatus` call.
    //
    // Phase 5 / Issue #37 — when `params.tx` is provided, the
    // UPDATE runs inside the caller's open transaction so the
    // audit-row INSERT (in `AuditLogService.recordWithExecutor`)
    // and the status UPDATE commit atomically.
    const executor = (params.tx as typeof this.db | undefined) ?? this.db;
    const updated = await executor
      .update(reviewReports)
      .set({ status: params.newStatus, updatedAt: params.nowIso })
      .where(
        and(
          eq(reviewReports.reportId, params.reportId),
          eq(reviewReports.status, params.currentStatus),
        ),
      )
      .returning({ reportId: reviewReports.reportId });
    return updated.length > 0;
  }

  /**
   * Phase 5 / Issue #39 — fetch the review id associated with a
   * report. The admin service uses this inside the actioned-status
   * transition so the soft-delete runs against the same row the
   * status UPDATE just modified, and against the same `tx` the
   * caller already opened (so all three writes — the status flip,
   * the soft-delete, and the audit row — commit atomically).
   *
   * Returns `null` when the report id does not exist.
   */
  async getReportReviewId(reportId: string, tx?: unknown): Promise<string | null> {
    const executor = (tx as typeof this.db | undefined) ?? this.db;
    const [row] = await executor
      .select({ reviewId: reviewReports.reviewId })
      .from(reviewReports)
      .where(eq(reviewReports.reportId, reportId))
      .limit(1);

    return row?.reviewId ?? null;
  }
}
