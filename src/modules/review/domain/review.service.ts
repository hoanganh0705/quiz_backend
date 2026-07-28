import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { quizReviews } from '@/core/database/schema';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';
import {
  REVIEW_REPORT_REPOSITORY_PORT,
  type ReviewReportRepositoryPort,
} from './ports/review-report-repository.port';
import { REVIEW_OUTBOX_PORT, type ReviewOutboxPort } from './ports/review-outbox.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ReviewNotFoundError,
  ReviewForbiddenError,
  ReviewConflictError,
  ReviewAttemptRequiredError,
  ReviewAlreadyReportedError,
  ReviewValidationError,
} from './errors';
import {
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEW_FORBIDDEN_MESSAGE,
  REVIEW_QUIZ_USER_CONFLICT_MESSAGE,
  REVIEW_ATTEMPT_REQUIRED_MESSAGE,
  REVIEW_QUIZ_NOT_FOUND_MESSAGE,
  REVIEW_SELF_VOTE_MESSAGE,
  REVIEW_SELF_REPORT_MESSAGE,
  REVIEW_FORBIDDEN_ANALYTICS_MESSAGE,
} from '../review.constants';
import {
  ReviewSubmittedEvent,
  ReviewDeletedEvent,
  REVIEW_DOMAIN_EVENT_BUS,
  type ReviewDomainEventBusPort,
} from './events';
import type { ReviewStatsRow } from './ports';
import type { ReviewDashboardResponseDto } from '../dto/response';
import {
  type ReviewActor,
  type ReviewTarget,
  type ReviewQuizTarget,
  ReviewAuthorizationPolicy,
} from './policies';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviewRepository: ReviewRepositoryPort,
    @Inject(REVIEW_REPORT_REPOSITORY_PORT)
    private readonly reportRepository: ReviewReportRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (quizId: string) => Promise<{
        quizId: string;
        creatorId: string | null;
        isHidden: boolean;
        publishedVersionId: string | null;
      } | null>;
    },
    @Inject(QuizAnalyticsService)
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @Inject(REVIEW_DOMAIN_EVENT_BUS)
    private readonly reviewEventBus: ReviewDomainEventBusPort,
    @Inject(REVIEW_OUTBOX_PORT)
    private readonly reviewOutbox: ReviewOutboxPort,
    @InjectPinoLogger(ReviewService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createReview(
    quizId: string,
    rating: number,
    comment: string | null | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    if (!quiz || !ReviewAuthorizationPolicy.isVisibleToReviewers(quiz)) {
      // Phase 1 / Issue #1 — hidden or unpublished quizzes must not be
      // reviewable. We collapse "not found", "soft-deleted", "hidden",
      // and "no published version" into a single 404 to avoid leaking
      // the existence of unpublished assets to users.
      throw new ReviewNotFoundError(REVIEW_QUIZ_NOT_FOUND_MESSAGE);
    }

    const hasAttempt = await this.reviewRepository.hasCompletedAttempt(quizId, user.sub);
    if (!hasAttempt) {
      this.logger.warn({
        event: 'review_attempt_required',
        quizId,
        userId: user.sub,
      });
      throw new ReviewAttemptRequiredError(REVIEW_ATTEMPT_REQUIRED_MESSAGE);
    }

    // Phase 2 / Issue #2 — the duplicate-review check used to live
    // here as a `SELECT` outside the transaction. Two concurrent
    // requests from the same user could both pass it and only the
    // UNIQUE index would catch the second one (with a `review_create_conflict`
    // log line per race). The same check now runs INSIDE the
    // transaction under a `pg_advisory_xact_lock` keyed on
    // `(quizId, userId)`, so the second caller deterministically
    // receives `ReviewConflictError` without burning a UNIQUE-violation
    // log. The pre-transaction `getReviewByQuizAndUser` is therefore
    // redundant and intentionally removed.

    try {
      const review = await this.db.transaction(async (tx) => {
        // Phase 2 / Issue #2 — pg_advisory_xact_lock serializes
        // concurrent `createReview` calls for the same (quizId,
        // userId) pair. The pre-check
        // `getReviewByQuizAndUser` above is still useful for the
        // common case (single-tab user, fast path), but two
        // concurrent calls from the same user can both pass it.
        // The advisory lock collapses both branches onto a single
        // path: the second transaction blocks until the first
        // commits, then re-checks inside the lock and throws
        // `ReviewConflictError` deterministically. The UNIQUE index
        // is still the source of truth — this lock is a
        // defense-in-depth that suppresses the `review_create_conflict`
        // log spam and keeps the 23505 path reserved for genuine
        // race conditions (e.g. an advisory-lock eviction).
        //
        // `hashtext` returns int4; we XOR the two hashes so two
        // (quiz, user) pairs cannot collide in the lock space
        // unless the inputs collide.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${quizId}) # hashtext(${user.sub}))`,
        );

        const existingInsideLock = await this.reviewRepository.getReviewByQuizAndUser(
          quizId,
          user.sub,
        );
        if (existingInsideLock) {
          this.logger.warn({
            event: 'review_duplicate',
            quizId,
            userId: user.sub,
          });
          throw new ReviewConflictError(REVIEW_QUIZ_USER_CONFLICT_MESSAGE);
        }

        const [created] = await tx
          .insert(quizReviews)
          .values({
            quizId,
            userId: user.sub,
            rating,
            comment: comment ?? null,
            createdAt: nowIso,
            updatedAt: nowIso,
            helpfulCount: 0,
          })
          .returning({
            reviewId: quizReviews.reviewId,
            quizId: quizReviews.quizId,
            userId: quizReviews.userId,
            rating: quizReviews.rating,
            comment: quizReviews.comment,
            createdAt: quizReviews.createdAt,
            updatedAt: quizReviews.updatedAt,
          });

        // Phase 1 / Issue #3 — schedule the analytics refresh through
        // the transactional outbox so the outbox row is committed
        // atomically with the new `quiz_reviews` row. If the
        // transaction rolls back, the outbox row never becomes visible
        // and the worker will not see a phantom event. The previous
        // implementation dispatched the event to the in-memory bus
        // after the transaction committed, which could lose the event
        // on application crash and silently drift the denormalized
        // counters in `quiz_stats`.
        await this.reviewOutbox.scheduleReviewSubmitted(
          {
            quizId,
            reviewId: created.reviewId,
            userId: created.userId,
            rating: created.rating,
          },
          tx,
          nowIso,
        );

        return created;
      });

      this.logger.info({
        event: 'review_created',
        reviewId: review.reviewId,
        quizId,
        userId: user.sub,
        rating,
      });

      this.reviewEventBus.dispatchToSubscribers(
        new ReviewSubmittedEvent({ quizId, reviewId: review.reviewId, userId: user.sub, rating }),
      );

      return review;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_quiz_reviews_quiz_user') {
        this.logger.warn({ event: 'review_create_conflict', quizId, userId: user.sub });
        throw new ReviewConflictError(REVIEW_QUIZ_USER_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async listReviews(
    quizId: string,
    limit: number,
    // Phase 5 / Issue #11 — cursor shape depends on sort.
    cursor?: import('./ports').ReviewListCursor | null,
    rating?: number,
    sort?: import('./ports').ReviewSort,
  ) {
    // Phase 1 / Issue #25 — listing reviews for a hidden or unpublished
    // quiz would leak both the existence of unpublished assets and the
    // identities of their authors. We mirror the gating used by
    // `getQuizReviewStats` so the two public read endpoints stay
    // consistent.
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    if (!quiz || !ReviewAuthorizationPolicy.isVisibleToReviewers(quiz)) {
      throw new ReviewNotFoundError(REVIEW_QUIZ_NOT_FOUND_MESSAGE);
    }
    return this.reviewRepository.listReviewsByQuiz({ quizId, limit, cursor, rating, sort });
  }

  async listUserReviews(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reviewId: string } | null },
  ): Promise<{
    items: import('./ports').MyReviewRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reviewId: string } | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.reviewRepository.listUserReviews({
      userId,
      limit,
      cursor,
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
          ? { createdAt: lastItem.createdAt, reviewId: lastItem.reviewId }
          : null,
    };
  }

  async listReviewsByUser(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reviewId: string } | null },
  ): Promise<{
    items: import('./ports').MyReviewRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reviewId: string } | null;
  }> {
    return this.listUserReviews(userId, query);
  }

  async getReviewById(reviewId: string): Promise<import('./ports').ReviewDetailByIdRow> {
    const review = await this.reviewRepository.findReviewById(reviewId);

    if (!review) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    // Phase 5 / Issue #20 — refuse to surface reviews of hidden
    // or unpublished quizzes. The endpoint is now auth-only at
    // the controller layer; the visibility check is the second
    // gate that stops an authenticated client from enumerating
    // hidden quizzes by guessing review UUIDs. We surface a 404
    // rather than a 403 so the existence of a review on a hidden
    // quiz is not leaked.
    await this.assertQuizVisibleById(review.quizId);

    return review;
  }

  async getMyQuizReview(
    quizId: string,
    userId: string,
  ): Promise<import('./ports').ReviewDetailByIdRow | null> {
    return await this.reviewRepository.getMyQuizReview(quizId, userId);
  }

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsRow | null> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz || !ReviewAuthorizationPolicy.isVisibleToReviewers(quiz)) {
      // Phase 1 / Issue #25 — public review-stats endpoint must refuse
      // hidden or unpublished quizzes. The 404 also stops ownership
      // enumeration (a creator who sets `is_hidden = true` should not
      // be told "this quiz exists, you just can't see it").
      throw new ReviewNotFoundError(REVIEW_QUIZ_NOT_FOUND_MESSAGE);
    }

    return this.reviewRepository.getQuizReviewStats(quizId);
  }

  async getMyReviewDashboard(userId: string): Promise<ReviewDashboardResponseDto> {
    const dashboard = await this.reviewRepository.getUserReviewDashboard(userId);

    return {
      totalReviews: Number(dashboard.totalReviews ?? 0),
      averageRatingGiven: Number(dashboard.averageRatingGiven ?? 0),
      favoriteCategory: dashboard.favoriteCategory,
      favoriteTag: dashboard.favoriteTag,
      lastUpdated: dashboard.lastUpdated,
    };
  }

  /**
   * Phase 1 / Issue #1 — central gate that a quiz is visible to
   * reviewers. Hidden or unpublished quizzes cannot receive
   * reviews, helpful votes, or reports.
   *
   * The policy returns false when the quiz is missing, hidden, or
   * has no published version; in every case we throw the same
   * `ReviewNotFoundError` to avoid leaking the existence of
   * unpublished assets.
   */
  private async assertQuizVisibleById(quizId: string): Promise<void> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    if (!quiz || !ReviewAuthorizationPolicy.isVisibleToReviewers(quiz)) {
      throw new ReviewNotFoundError(REVIEW_QUIZ_NOT_FOUND_MESSAGE);
    }
  }

  /**
   * Load the review and assert that `userId` is allowed to vote on it.
   *
   * Throws `ReviewNotFoundError` if the review does not exist, and
   * `ReviewValidationError` if the actor is the review's author.
   *
   * Shared by `addHelpfulVote` and `removeHelpfulVote` so both endpoints
   * share one fetch and one self-vote rejection.
   *
   * Phase 5 / Issue #19 — the lookup uses `getReviewById`, which
   * selects only the columns of `quiz_reviews` (no joins). The
   * audit's recommendation originally called out a heavyweight
   * query path (`findReviewById`) that joined `users` and `quizzes`
   * for every vote attempt; the service was already pointing at the
   * slim method, so no schema change is needed. The comment is kept
   * here so a future contributor does not "optimize" this back to
   * the joined version.
   */
  private async assertCanVote(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.getReviewById(reviewId);

    if (!review) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    // Phase 1 / Issue #1 — voting on a hidden quiz's review is not
    // a useful operation for the public, but a reviewer who voted
    // before the quiz was hidden still expects to be able to undo
    // their vote. We restrict the read to a visible quiz for the
    // *add* path; the *remove* path uses the same helper and
    // therefore inherits the same restriction. A future change can
    // allow the author to withdraw votes on hidden quizzes they
    // already cast, but that is a product decision outside Phase 1.
    await this.assertQuizVisibleById(review.quizId);

    if (review.userId === userId) {
      this.logger.warn({ event: 'review_self_helpful_vote', reviewId, userId });
      throw new ReviewValidationError(REVIEW_SELF_VOTE_MESSAGE);
    }
  }

  async addHelpfulVote(reviewId: string, userId: string): Promise<boolean> {
    // Phase 5 / Issue #17 — `getReviewById` filters by
    // `deleted_at IS NULL`, so calling this on a soft-deleted
    // review throws `ReviewNotFoundError`. That is the desired
    // behavior for the *add* path: we don't accept fresh helpful
    // votes against content the moderator (or the author) chose
    // to take down.
    await this.assertCanVote(reviewId, userId);

    const inserted = await this.reviewRepository.addHelpfulVote({
      reviewId,
      userId,
      nowIso: new Date().toISOString(),
    });

    if (inserted) {
      this.logger.info({ event: 'review_helpful_voted', reviewId, userId, helpful: true });
    }

    return inserted;
  }

  async removeHelpfulVote(reviewId: string, userId: string): Promise<boolean> {
    // Phase 5 / Issue #17 — the *withdrawal* path is the
    // inverse of the add path: a user who voted "helpful"
    // against a now-soft-deleted review should still be able
    // to withdraw that vote, otherwise their vote row would
    // survive the soft-delete indefinitely (which is exactly
    // what the audit flagged). We use the slim
    // `reviewExistsIncludingDeleted` helper which does NOT
    // filter on `deleted_at`, so this method works for live
    // and soft-deleted reviews alike.
    const exists = await this.reviewRepository.reviewExistsIncludingDeleted(reviewId);

    if (!exists) {
      this.logger.warn({
        event: 'review_helpful_withdraw_review_not_found',
        reviewId,
        userId,
      });
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const removed = await this.reviewRepository.removeHelpfulVote({
      reviewId,
      userId,
      nowIso: new Date().toISOString(),
    });

    if (removed) {
      this.logger.info({ event: 'review_helpful_vote_removed', reviewId, userId, helpful: false });
    }

    return removed;
  }

  async reportReview(
    reviewId: string,
    reporterId: string,
    reason: string,
    details: string | null,
  ): Promise<void> {
    const review = await this.reviewRepository.getReviewById(reviewId);

    if (!review) {
      this.logger.warn({ event: 'review_report_review_not_found', reviewId, reporterId });
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    // Phase 1 / Issue #1 — do not accept reports against reviews of
    // hidden or unpublished quizzes; the underlying asset is
    // off-limits to public moderation flows.
    await this.assertQuizVisibleById(review.quizId);

    if (
      !ReviewAuthorizationPolicy.canReport({
        reviewId,
        authorUserId: review.userId,
        reporterUserId: reporterId,
      })
    ) {
      // Phase 5 / hardening — the previous shape inlined this
      // check as `review.userId === reporterId`. It was easy to
      // miss in review and was never tested at the integration
      // layer. The rule now lives in
      // `ReviewAuthorizationPolicy.canReport` so it has a single
      // source of truth and a dedicated unit spec. The DB also
      // enforces the same invariant through a CHECK constraint on
      // `review_reports` (migration `0016`), so even a future code
      // path that bypasses the application guard cannot insert a
      // self-report — Postgres raises `23514` and the repository
      // translates it back to `ReviewValidationError`.
      this.logger.warn({
        event: 'review_self_report',
        reviewId,
        reporterId,
        authorUserId: review.userId,
      });
      throw new ReviewValidationError(REVIEW_SELF_REPORT_MESSAGE);
    }

    const hasReported = await this.reportRepository.hasUserReportedReview(reviewId, reporterId);

    if (hasReported) {
      this.logger.warn({ event: 'review_report_duplicate', reviewId, reporterId, reason });
      throw new ReviewAlreadyReportedError();
    }

    const report = await this.reportRepository.createReport({
      reviewId,
      reporterId,
      reason,
      details,
      nowIso: new Date().toISOString(),
    });

    this.logger.info({
      event: 'review_reported',
      reportId: report.reportId,
      reviewId,
      reporterId,
      reason,
      status: report.status,
    });
  }

  async updateReview(
    quizId: string,
    rating: number,
    // Phase 5 / Issue #24 — `comment` is `{ set: string | null }`
    // when the client explicitly included the field in the PATCH
    // body, or `undefined` when the client omitted it. The
    // repository distinguishes the two cases and only writes
    // `comment` when `set` is present.
    comment: { set: string | null } | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    // Phase 1 / Issue #1 — refuse updates on hidden or unpublished
    // quizzes. The same predicate is applied on `createReview` so the
    // two sides of the lifecycle stay consistent.
    await this.assertQuizVisibleById(quizId);

    const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const actor: ReviewActor = { sub: user.sub, role: user.role };
    const target: ReviewTarget = { reviewId: existing.reviewId, userId: existing.userId };

    if (!ReviewAuthorizationPolicy.canModify(actor, target)) {
      throw new ReviewForbiddenError(REVIEW_FORBIDDEN_MESSAGE);
    }

    const updated = await this.reviewRepository.updateReview({
      reviewId: existing.reviewId,
      rating,
      comment,
      nowIso,
    });

    this.logger.info({
      event: 'review_updated',
      reviewId: existing.reviewId,
      userId: user.sub,
      rating,
    });

    this.reviewEventBus.dispatchToSubscribers(
      new ReviewSubmittedEvent({ quizId, reviewId: existing.reviewId, userId: user.sub, rating }),
    );

    return updated;
  }

  async deleteReview(quizId: string, user: JwtPayload) {
    // Phase 1 / Issue #1 — refuse deletes on hidden or unpublished
    // quizzes. Mirrors the create/update check so the full mutation
    // surface is uniformly gated.
    await this.assertQuizVisibleById(quizId);

    const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const actorDelete: ReviewActor = { sub: user.sub, role: user.role };
    const targetDelete: ReviewTarget = { reviewId: existing.reviewId, userId: existing.userId };

    if (!ReviewAuthorizationPolicy.canModify(actorDelete, targetDelete)) {
      throw new ReviewForbiddenError(REVIEW_FORBIDDEN_MESSAGE);
    }

    const nowIso = new Date().toISOString();
    let didSoftDelete = false;

    await this.db.transaction(async (tx) => {
      // Phase 5 / Issue #17 — soft-delete writes
      // `deleted_at = now` instead of issuing `DELETE FROM
      // quiz_reviews`. The previous shape cascaded into
      // `review_helpful_votes` and erased every vote against
      // the review with no UI signal for the voter. Soft-delete
      // preserves the vote rows so voters can still withdraw
      // their vote through `DELETE /reviews/:reviewId/helpful`.
      // The repository filters every public read by
      // `deleted_at IS NULL`, so the row is invisible everywhere
      // a client could see it.
      didSoftDelete = await this.reviewRepository.softDeleteReview(existing.reviewId, nowIso);

      if (!didSoftDelete) {
        // The review was already soft-deleted between the
        // read and the write — treat as a no-op so the
        // DELETE endpoint stays idempotent. The outer
        // transaction will roll back the outbox row by
        // simply not having scheduled one.
        return;
      }

      // Phase 1 / Issue #3 — schedule the analytics refresh through
      // the transactional outbox so the soft-delete + outbox insert
      // are atomic. See the matching call in `createReview` for the
      // rationale.
      await this.reviewOutbox.scheduleReviewDeleted(
        { quizId, reviewId: existing.reviewId },
        tx,
        nowIso,
      );
    });

    if (!didSoftDelete) {
      // Already soft-deleted — idempotent success, no event, no log.
      return;
    }

    this.logger.info({
      event: 'review_deleted',
      reviewId: existing.reviewId,
      userId: user.sub,
    });

    this.reviewEventBus.dispatchToSubscribers(
      new ReviewDeletedEvent({ quizId, reviewId: existing.reviewId }),
    );
  }

  async listReportedReviews(
    reporterId: string,
    query: {
      limit?: number;
      cursor?: { createdAt: string; reportId: string } | null;
      status?: import('./policies/review-report-status.policy').ReviewReportStatus | null;
    },
  ): Promise<{
    items: import('./ports').ReportedReviewRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reportId: string } | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.reportRepository.listReportedReviews({
      reporterId,
      limit,
      cursor,
      status: query.status ?? null,
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

  async getCreatorQuizReviewAnalytics(
    quizId: string,
    user: JwtPayload,
  ): Promise<import('@/modules/quiz/domain/analytics/types').QuizAnalytics> {
    const actor: ReviewActor = { sub: user.sub, role: user.role };
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new ReviewNotFoundError(REVIEW_QUIZ_NOT_FOUND_MESSAGE);
    }

    const analyticsTarget: ReviewQuizTarget = { quizId, creatorId: quiz.creatorId };

    if (!ReviewAuthorizationPolicy.canViewAnalytics(actor, analyticsTarget)) {
      throw new ReviewForbiddenError(REVIEW_FORBIDDEN_ANALYTICS_MESSAGE);
    }

    return this.quizAnalyticsService.getQuizAnalytics(quizId);
  }
}
