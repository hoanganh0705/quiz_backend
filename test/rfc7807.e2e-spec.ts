/// <reference types="jest" />
/**
 * Phase 0 RFC 7807 e2e backstop.
 *
 * Boots an isolated NestJS app with:
 *   - `GlobalExceptionFilter` registered globally (matches production wiring)
 *   - stub `PinoLogger` + stub `ServerConfig` (no Postgres / Redis / pino
 *     transport needed — runs as part of `pnpm test:e2e` without infra)
 *   - a fixture controller that throws one error per code path:
 *       * a concrete `BaseDomainException`
 *       * native `NotFoundException` (HttpException, status-based)
 *       * native `BadRequestException` with a string-array message
 *         (the shape produced by NestJS `ValidationPipe`)
 *       * plain `Error` (uncaught → 500 in production, surfaced in dev)
 *       * a non-`Error` throwable (string) — sanity check
 *
 * The test asserts the **canonical ProblemDetail wire shape** for each
 * path: Content-Type, top-level fields, `extensions.requestId`, and the
 * `instance` URI derived from the request URL.
 *
 * As RFC 7807 standardization progresses through Phases 1-4, this file is
 * amended per-phase to cover new code paths (per-module `code` synthesis,
 * mapping lookup, native-validation `code`, etc.). Until Phase 1 ships,
 * only the global filter's existing behavior is covered — which is
 * intentional: Phase 0 must not depend on per-module changes.
 */
import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import {
  DeletionFailedError,
  InvalidCredentialsError,
  InvalidOAuthTokenError,
  InvalidPasswordError,
  InvalidRefreshTokenError,
  InvalidTokenError,
  PasswordReuseError,
  RateLimitExceededError,
  ResourceConflictError,
  SessionContextMismatchError,
  SessionNotFoundError,
  TokenReuseDetectedError,
  UserNotFoundError,
} from '@/modules/auth/domain/errors';
import {
  QuizAnswerOptionPositionConflictError,
  QuizConflictError,
  QuizForbiddenError,
  QuizInsufficientQuestionsError,
  QuizMultipleCorrectOptionsError,
  QuizNotFoundError,
  QuizOperationFailedError,
  QuizQuestionPositionConflictError,
  QuizSlugConflictError,
  QuizValidationError,
  QuizVersionImmutableError,
} from '@/modules/quiz/domain/errors';
import {
  AnalyticsCalculationError,
  QuizNotFoundError as QuizAnalyticsNotFoundError,
} from '@/modules/quiz/domain/analytics/errors';
import {
  AttemptAlreadyStartedError,
  AttemptAnswerNotFoundError,
  AttemptForbiddenError,
  AttemptNotActiveError,
  AttemptNotCompletedError,
  AttemptNotFoundError,
  AttemptQuestionAlreadyAnsweredError,
  AttemptQuestionInvalidError,
  AttemptValidationError,
  QuizNotPublishedError,
} from '@/modules/attempt/domain/errors';
import {
  UserAnalyticsNotFoundError,
  UserNotFoundError as UserModuleNotFoundError,
  UserProfilePrivateError,
  UserRankingNotFoundError,
} from '@/modules/user/domain/errors';
import {
  CategoryAlreadyActiveError,
  CategoryAnalyticsNotFoundError,
  CategoryNotFoundError,
  CategoryRestoreInvariantError,
  CategorySlugConflictError,
} from '@/modules/category/domain/errors';
import {
  TagAlreadyActiveError,
  TagAnalyticsNotFoundError,
  TagNotFoundError,
  TagRestoreInvariantError,
  TagSlugConflictError,
} from '@/modules/tag/domain/errors';
import {
  TournamentAlreadyRegisteredError,
  TournamentAlreadyWithdrawnError,
  TournamentAttemptAlreadyExistsError,
  TournamentConflictError,
  TournamentForbiddenError,
  TournamentFullError,
  TournamentNotFoundError,
  TournamentNotRegisteredError,
  TournamentParticipantStateError,
  TournamentRegistrationClosedError,
  TournamentRoundNotFoundError,
  TournamentRoundNotOpenError,
  TournamentUnregisterClosedError,
  TournamentValidationError,
  TournamentWithdrawClosedError,
} from '@/modules/tournament/domain/errors';
import {
  ReviewAlreadyReportedError,
  ReviewAttemptRequiredError,
  ReviewConflictError,
  ReviewForbiddenError,
  ReviewNotFoundError,
  ReviewValidationError,
} from '@/modules/review/domain/errors';
import {
  BookmarkCollectionNotFoundError,
  BookmarkConflictError,
  BookmarkNotFoundError,
  BookmarkValidationError,
  CollectionConflictError,
  CollectionForbiddenError,
  CollectionNotFoundError,
} from '@/modules/bookmark/domain/errors';
import {
  InstanceAlreadyClosedError,
  InstanceAlreadyStartedError,
  InstanceFullError,
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  PlayerAlreadyJoinedError,
} from '@/modules/instance/domain/errors';
import {
  AlreadyFriendsError,
  BlockedUserError,
  FriendListForbiddenError,
  FriendRequestForbiddenError,
  FriendRequestNotFoundError,
  PendingRequestExistsError,
  SelfFriendRequestError,
  UserBlockedError,
} from '@/modules/social/domain/errors';
import {
  AchievementGrantError,
  AchievementUserNotFoundError,
  BadgeNotFoundError,
  UserBadgeOwnershipNotFoundError,
} from '@/modules/achievement/domain/errors';
import {
  CommentForbiddenError,
  CommentNotFoundError,
  CommentThreadMismatchError,
  DuplicateReportError,
  ModeratorRequiredError,
  QuizNotFoundError as DiscussionQuizNotFoundError,
  SelfReportError,
  SelfVoteError,
  ThreadClosedError,
  ThreadForbiddenError,
  ThreadNotActiveError,
  ThreadNotFoundError,
} from '@/modules/discussion/domain/errors';
import {
  InvalidXpEventError,
  PeriodResetError,
  RankCalculationError,
} from '@/modules/ranking/domain/errors';
import {
  NotificationForbiddenError,
  NotificationNotFoundError,
} from '@/modules/notification/domain/errors';
import { serverConfig } from '@/core/config';

interface ProblemWire {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly extensions?: Record<string, unknown>;
}

class FixtureNotFoundError extends BaseDomainException {
  readonly code = 'FIXTURE_NOT_FOUND';
  constructor(id: string) {
    super(`Fixture '${id}' was not found.`);
  }
}

@Controller('rfc7807-fixture')
class Rfc7807FixtureController {
  @Get('domain-not-found')
  domainNotFound(): never {
    throw new FixtureNotFoundError('abc-123');
  }

  // Auth-module endpoints — Phase 1 live-mapping coverage.
  // Each endpoint throws a real auth exception. If `ProblemCodeMapping`
  // or the auth classes drift, the e2e tests in the auth describe-block
  // below fail.

  @Get('auth/invalid-credentials')
  authInvalidCredentials(): never {
    throw new InvalidCredentialsError();
  }

  @Get('auth/invalid-refresh-token')
  authInvalidRefreshToken(): never {
    throw new InvalidRefreshTokenError();
  }

  @Get('auth/token-reused')
  authTokenReused(): never {
    throw new TokenReuseDetectedError();
  }

  @Get('auth/session-context-mismatch')
  authSessionContextMismatch(): never {
    throw new SessionContextMismatchError();
  }

  @Get('auth/user-not-found')
  authUserNotFound(): never {
    throw new UserNotFoundError();
  }

  @Get('auth/rate-limited')
  authRateLimited(): never {
    throw new RateLimitExceededError();
  }

  @Get('auth/resource-conflict')
  authResourceConflict(): never {
    throw new ResourceConflictError();
  }

  @Get('auth/session-not-found')
  authSessionNotFound(): never {
    throw new SessionNotFoundError();
  }

  @Get('auth/invalid-token')
  authInvalidToken(): never {
    throw new InvalidTokenError();
  }

  @Get('auth/invalid-current-password')
  authInvalidCurrentPassword(): never {
    throw new InvalidPasswordError();
  }

  @Get('auth/deletion-failed')
  authDeletionFailed(): never {
    throw new DeletionFailedError();
  }

  @Get('auth/password-reuse')
  authPasswordReuse(): never {
    throw new PasswordReuseError();
  }

  @Get('auth/oauth-invalid-token')
  authOAuthInvalidToken(): never {
    throw new InvalidOAuthTokenError();
  }

  // Quiz-module endpoints — Phase 1 live-mapping coverage.
  // Each endpoint throws a real quiz exception. If `ProblemCodeMapping`
  // or the quiz classes drift, the e2e tests in the quiz describe-block
  // below fail.

  @Get('quiz/not-found')
  quizNotFound(): never {
    throw new QuizNotFoundError();
  }

  @Get('quiz/forbidden')
  quizForbidden(): never {
    throw new QuizForbiddenError();
  }

  @Get('quiz/slug-conflict')
  quizSlugConflict(): never {
    throw new QuizSlugConflictError();
  }

  @Get('quiz/conflict')
  quizConflict(): never {
    throw new QuizConflictError();
  }

  @Get('quiz/validation-failed')
  quizValidationFailed(): never {
    throw new QuizValidationError();
  }

  @Get('quiz/version-immutable')
  quizVersionImmutable(): never {
    throw new QuizVersionImmutableError();
  }

  @Get('quiz/insufficient-questions')
  quizInsufficientQuestions(): never {
    throw new QuizInsufficientQuestionsError();
  }

  @Get('quiz/question-position-conflict')
  quizQuestionPositionConflict(): never {
    throw new QuizQuestionPositionConflictError();
  }

  @Get('quiz/answer-option-position-conflict')
  quizAnswerOptionPositionConflict(): never {
    throw new QuizAnswerOptionPositionConflictError();
  }

  @Get('quiz/multiple-correct-options')
  quizMultipleCorrectOptions(): never {
    throw new QuizMultipleCorrectOptionsError();
  }

  @Get('quiz/operation-failed')
  quizOperationFailed(): never {
    throw new QuizOperationFailedError();
  }

  @Get('quiz/analytics-not-found')
  quizAnalyticsNotFound(): never {
    throw new QuizAnalyticsNotFoundError('quiz-xyz');
  }

  @Get('quiz/analytics-calculation-failed')
  quizAnalyticsCalculationFailed(): never {
    throw new AnalyticsCalculationError('divide by zero');
  }

  // Attempt-module endpoints — Phase 1 live-mapping coverage.
  // Each endpoint throws a real attempt exception. If `ProblemCodeMapping`
  // or the attempt classes drift, the e2e tests in the attempt
  // describe-block below fail.

  @Get('attempt/not-found')
  attemptNotFound(): never {
    throw new AttemptNotFoundError();
  }

  @Get('attempt/forbidden')
  attemptForbidden(): never {
    throw new AttemptForbiddenError();
  }

  @Get('attempt/validation-failed')
  attemptValidationFailed(): never {
    throw new AttemptValidationError();
  }

  @Get('attempt/already-started')
  attemptAlreadyStarted(): never {
    throw new AttemptAlreadyStartedError();
  }

  @Get('attempt/not-active')
  attemptNotActive(): never {
    throw new AttemptNotActiveError();
  }

  @Get('attempt/question-already-answered')
  attemptQuestionAlreadyAnswered(): never {
    throw new AttemptQuestionAlreadyAnsweredError();
  }

  @Get('attempt/quiz-not-published')
  attemptQuizNotPublished(): never {
    throw new QuizNotPublishedError();
  }

  @Get('attempt/question-invalid')
  attemptQuestionInvalid(): never {
    throw new AttemptQuestionInvalidError();
  }

  @Get('attempt/not-completed')
  attemptNotCompleted(): never {
    throw new AttemptNotCompletedError();
  }

  @Get('attempt/answer-not-found')
  attemptAnswerNotFound(): never {
    // This exception class is currently dead code (exported but never
    // thrown anywhere in the codebase). It is included here to pin the
    // mapping contract: if/when a call site starts throwing it, the
    // wire shape is already verified.
    throw new AttemptAnswerNotFoundError();
  }

  // User-module endpoints — Phase 1 live-mapping coverage.
  // Each endpoint throws a real user exception. If `ProblemCodeMapping`
  // or the user classes drift, the e2e tests in the user describe-block
  // below fail.

  @Get('user/not-found')
  userNotFound(): never {
    throw new UserModuleNotFoundError();
  }

  @Get('user/not-found-with-message')
  userNotFoundWithMessage(): never {
    // Wire-shape improvement: the prior per-module filter hardcoded
    // `detail: 'User not found'`, ignoring the thrown message. The
    // global filter preserves `exception.message`, so a custom message
    // now reaches the wire.
    throw new UserModuleNotFoundError('User not found or already deleted');
  }

  @Get('user/ranking-not-found')
  userRankingNotFound(): never {
    // Dead-code class — exported but never thrown in the codebase.
    throw new UserRankingNotFoundError();
  }

  @Get('user/analytics-not-found')
  userAnalyticsNotFound(): never {
    // Dead-code class — exported but never thrown in the codebase.
    throw new UserAnalyticsNotFoundError();
  }

  @Get('user/profile-private')
  userProfilePrivate(): never {
    throw new UserProfilePrivateError('user-abc');
  }

  // Category-module endpoints — Phase 2 live-mapping coverage (first Phase 2
  // module migrated). The category module previously emitted the legacy
  // `{ statusCode, message, error }` envelope; after Phase 2 it emits the
  // canonical ProblemDetail shape. Each endpoint throws a real category
  // exception; if `ProblemCodeMapping` or the category classes drift, the
  // e2e tests in the category describe-block below fail.

  @Get('category/not-found')
  categoryNotFound(): never {
    throw new CategoryNotFoundError();
  }

  @Get('category/analytics-not-found')
  categoryAnalyticsNotFound(): never {
    throw new CategoryAnalyticsNotFoundError();
  }

  @Get('category/slug-conflict')
  categorySlugConflict(): never {
    throw new CategorySlugConflictError();
  }

  @Get('category/already-active')
  categoryAlreadyActive(): never {
    throw new CategoryAlreadyActiveError();
  }

  @Get('category/restore-invariant')
  categoryRestoreInvariant(): never {
    throw new CategoryRestoreInvariantError();
  }

  // Tag-module endpoints — Phase 2 live-mapping coverage. Structurally
  // identical to category (same 5-class shape, same 404/404/409/409/500
  // status mapping). Each endpoint throws a real tag exception; if
  // `ProblemCodeMapping` or the tag classes drift, the e2e tests in the
  // tag describe-block below fail.

  @Get('tag/not-found')
  tagNotFound(): never {
    throw new TagNotFoundError();
  }

  @Get('tag/analytics-not-found')
  tagAnalyticsNotFound(): never {
    throw new TagAnalyticsNotFoundError();
  }

  @Get('tag/slug-conflict')
  tagSlugConflict(): never {
    throw new TagSlugConflictError();
  }

  @Get('tag/already-active')
  tagAlreadyActive(): never {
    throw new TagAlreadyActiveError();
  }

  @Get('tag/restore-invariant')
  tagRestoreInvariant(): never {
    throw new TagRestoreInvariantError();
  }

  // Tournament-module endpoints — Phase 2 live-mapping coverage. Largest
  // Phase-2 module by class count (15 exceptions). Each endpoint throws
  // a real tournament exception; if `ProblemCodeMapping` or the
  // tournament classes drift, the e2e tests in the tournament
  // describe-block below fail.

  @Get('tournament/not-found')
  tournamentNotFound(): never {
    throw new TournamentNotFoundError();
  }

  @Get('tournament/round-not-found')
  tournamentRoundNotFound(): never {
    throw new TournamentRoundNotFoundError();
  }

  @Get('tournament/not-registered')
  tournamentNotRegistered(): never {
    throw new TournamentNotRegisteredError();
  }

  @Get('tournament/forbidden')
  tournamentForbidden(): never {
    throw new TournamentForbiddenError();
  }

  @Get('tournament/conflict')
  tournamentConflict(): never {
    throw new TournamentConflictError();
  }

  @Get('tournament/already-registered')
  tournamentAlreadyRegistered(): never {
    throw new TournamentAlreadyRegisteredError();
  }

  @Get('tournament/attempt-already-exists')
  tournamentAttemptAlreadyExists(): never {
    throw new TournamentAttemptAlreadyExistsError();
  }

  @Get('tournament/participant-state')
  tournamentParticipantState(): never {
    throw new TournamentParticipantStateError(
      'Participant is in unexpected state "withdrawn" for this operation',
    );
  }

  @Get('tournament/already-withdrawn')
  tournamentAlreadyWithdrawn(): never {
    // Wire-shape fix (not a regression): the prior per-module filter
    // did NOT include this exception in `mapToHttp`, so it fell
    // through to the default `INTERNAL_SERVER_ERROR` with a generic
    // `'Internal server error'` message. Phase 2 routes it to 409.
    throw new TournamentAlreadyWithdrawnError();
  }

  @Get('tournament/validation')
  tournamentValidation(): never {
    throw new TournamentValidationError();
  }

  @Get('tournament/registration-closed')
  tournamentRegistrationClosed(): never {
    throw new TournamentRegistrationClosedError();
  }

  @Get('tournament/full')
  tournamentFull(): never {
    throw new TournamentFullError();
  }

  @Get('tournament/round-not-open')
  tournamentRoundNotOpen(): never {
    throw new TournamentRoundNotOpenError();
  }

  @Get('tournament/unregister-closed')
  tournamentUnregisterClosed(): never {
    throw new TournamentUnregisterClosedError();
  }

  @Get('tournament/withdraw-closed')
  tournamentWithdrawClosed(): never {
    throw new TournamentWithdrawClosedError();
  }

  // Review-module endpoints — Phase 2 live-mapping coverage. 6 concrete
  // exceptions → 4 status codes (400/403/404/409). Each endpoint throws
  // a real review exception; if `ProblemCodeMapping` or the review
  // classes drift, the e2e tests in the review describe-block below
  // fail.

  @Get('review/not-found')
  reviewNotFound(): never {
    // Verify wire-shape improvement: 3 throw sites pass `'Quiz not
    // found'`. The prior filter rewrote them to `'Review not found'`.
    // The global filter preserves the thrown message.
    throw new ReviewNotFoundError('Quiz not found');
  }

  @Get('review/forbidden')
  reviewForbidden(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'You do not have permission to perform this action'`. Global
    // filter preserves thrown message.
    throw new ReviewForbiddenError();
  }

  @Get('review/conflict')
  reviewConflict(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource already exists'`. Global filter preserves thrown
    // message (`'You have already reviewed this quiz'`).
    throw new ReviewConflictError();
  }

  @Get('review/validation')
  reviewValidation(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new ReviewValidationError('You cannot vote on your own review');
  }

  @Get('review/attempt-required')
  reviewAttemptRequired(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new ReviewAttemptRequiredError();
  }

  @Get('review/already-reported')
  reviewAlreadyReported(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'You have already reported this review'`. Global filter
    // preserves thrown message (which happens to be the same string
    // by default).
    throw new ReviewAlreadyReportedError();
  }

  // Bookmark-module endpoints — Phase 2 live-mapping coverage. 7
  // concrete exceptions → 4 status codes (400/403/404/409). Each
  // endpoint throws a real bookmark exception; if
  // `ProblemCodeMapping` or the bookmark classes drift, the e2e tests
  // in the bookmark describe-block below fail.

  @Get('bookmark/not-found')
  bookmarkNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource not found'`. Global filter preserves thrown message.
    throw new BookmarkNotFoundError();
  }

  @Get('bookmark/collection-not-found')
  bookmarkCollectionNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource not found'`. Global filter preserves thrown message.
    // One call site passes `'Quiz not found'`.
    throw new CollectionNotFoundError('Quiz not found');
  }

  @Get('bookmark/analytics-not-found')
  bookmarkAnalyticsNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Bookmark collection analytics not found'`, even when a
    // distinct message was thrown. Global filter preserves thrown
    // message.
    throw new BookmarkCollectionNotFoundError(
      'Collection was deleted while processing this request. Please retry.',
    );
  }

  @Get('bookmark/collection-forbidden')
  bookmarkCollectionForbidden(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'You do not have permission to perform this action'`. Global
    // filter preserves thrown message.
    throw new CollectionForbiddenError();
  }

  @Get('bookmark/conflict')
  bookmarkConflict(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource already exists'`. Global filter preserves thrown
    // message.
    throw new BookmarkConflictError();
  }

  @Get('bookmark/collection-conflict')
  bookmarkCollectionConflict(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource already exists'`. Global filter preserves thrown
    // message.
    throw new CollectionConflictError();
  }

  @Get('bookmark/validation')
  bookmarkValidation(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new BookmarkValidationError('Bookmark validation failed');
  }

  // Instance-module endpoints — Phase 2 live-mapping coverage. 7
  // concrete exceptions → 4 status codes (400/403/404/409). Each
  // endpoint throws a real instance exception; if
  // `ProblemCodeMapping` or the instance classes drift, the e2e tests
  // in the instance describe-block below fail.
  //
  // Special note: the instance module has TWO exception filters —
  // `InstanceDomainExceptionFilter` (HTTP, controller-scoped, deleted
  // in Phase 2) and `WsExceptionFilter` (WS gateway, KEPT — handles
  // only auth/generic, not domain errors). The HTTP endpoint block
  // here only exercises the HTTP path.

  @Get('instance/not-found')
  instanceNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource not found'`. Global filter preserves thrown
    // message.
    throw new InstanceNotFoundError();
  }

  @Get('instance/not-host')
  instanceNotHost(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'You do not have permission to perform this action'`. Global
    // filter preserves thrown message.
    throw new InstanceNotHostError();
  }

  @Get('instance/not-open')
  instanceNotOpen(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new InstanceNotOpenError();
  }

  @Get('instance/full')
  instanceFull(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new InstanceFullError();
  }

  @Get('instance/already-started')
  instanceAlreadyStarted(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new InstanceAlreadyStartedError();
  }

  @Get('instance/already-closed')
  instanceAlreadyClosed(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Invalid request data'`. Global filter preserves thrown
    // message.
    throw new InstanceAlreadyClosedError();
  }

  @Get('instance/player-already-joined')
  instancePlayerAlreadyJoined(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Resource already exists'`. Global filter preserves thrown
    // message. Note: this exception is defined but currently not
    // thrown by `instance.service.ts` — see docblock on
    // `PlayerAlreadyJoinedError`.
    throw new PlayerAlreadyJoinedError();
  }

  // Social-module endpoints — Phase 2 live-mapping coverage. 8
  // concrete exceptions → 4 status codes (400/403/404/409). Each
  // endpoint throws a real social exception; if
  // `ProblemCodeMapping` or the social classes drift, the e2e tests
  // in the social describe-block below fail.

  @Get('social/friend-request-not-found')
  socialFriendRequestNotFound(): never {
    // Verify wire-shape improvement: prior filter dropped the
    // request ID and rewrote all to `'Friend request not found'`.
    // Global filter preserves thrown message including the
    // interpolated ID.
    throw new FriendRequestNotFoundError('abc-123');
  }

  @Get('social/friend-request-forbidden')
  socialFriendRequestForbidden(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'You do not have permission to perform this action'`. Global
    // filter preserves thrown message.
    throw new FriendRequestForbiddenError();
  }

  @Get('social/friend-list-forbidden')
  socialFriendListForbidden(): never {
    // Prior filter preserved this message verbatim; behavior
    // unchanged. Verifies mapping resolves to 403.
    throw new FriendListForbiddenError();
  }

  @Get('social/self-friend-request')
  socialSelfFriendRequest(): never {
    // Prior filter preserved this message verbatim; behavior
    // unchanged. Verifies mapping resolves to 400.
    throw new SelfFriendRequestError();
  }

  @Get('social/already-friends')
  socialAlreadyFriends(): never {
    // Prior filter preserved this message verbatim; behavior
    // unchanged. Verifies mapping resolves to 409.
    throw new AlreadyFriendsError();
  }

  @Get('social/blocked-user')
  socialBlockedUser(): never {
    // Prior filter preserved this message verbatim; behavior
    // unchanged. Verifies mapping resolves to 403.
    throw new BlockedUserError();
  }

  @Get('social/user-blocked')
  socialUserBlocked(): never {
    // Prior filter preserved this message verbatim; behavior
    // unchanged. Verifies mapping resolves to 403.
    throw new UserBlockedError();
  }

  @Get('social/pending-request-exists')
  socialPendingRequestExists(): never {
    // Prior filter preserved this message verbatim; behavior
    // unchanged. Verifies mapping resolves to 409.
    throw new PendingRequestExistsError();
  }

  // Achievement-module endpoints — Phase 2 live-mapping coverage. 4
  // concrete exceptions → 2 status codes (404 + 500). Each
  // endpoint throws a real achievement exception; if
  // `ProblemCodeMapping` or the achievement classes drift, the e2e
  // tests in the achievement describe-block below fail.
  //
  // Special note: the prior per-module filter
  // `@Catch(AchievementDomainError, UserProfilePrivateError)` also
  // caught the cross-module `UserProfilePrivateError` from the user
  // module. After Phase 2 the achievement filter is removed; the
  // global filter handles both via their mapping entries. We exercise
  // the `UserProfilePrivateError` resolution through an
  // achievement-named endpoint so a regression test verifies the
  // cross-module throwing path still routes correctly.

  @Get('achievement/badge-not-found')
  achievementBadgeNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'Badge not found'`. Global filter preserves thrown message
    // including the interpolated badge ID.
    throw new BadgeNotFoundError('badge-abc');
  }

  @Get('achievement/user-not-found')
  achievementUserNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'User not found'`. Global filter preserves thrown message
    // including the interpolated user ID.
    throw new AchievementUserNotFoundError('user-1');
  }

  @Get('achievement/user-badge-ownership-not-found')
  achievementUserBadgeOwnershipNotFound(): never {
    // Verify wire-shape improvement: prior filter rewrote all to
    // `'User badge not found'`. Global filter preserves thrown
    // message including both interpolated IDs.
    throw new UserBadgeOwnershipNotFoundError('user-1', 'badge-abc');
  }

  @Get('achievement/grant-error')
  achievementGrantError(): never {
    // Wire-shape improvement: prior filter had NO branch for
    // `AchievementGrantError` — fell through to catch-all 500 with
    // hardcoded `'Internal server error'`. Global filter resolves
    // the code and preserves the thrown message including the user
    // ID and reason. Note: this exception is defined but currently
    // not thrown by `achievement.application.service.ts`.
    throw new AchievementGrantError('user-1', 'rule-engine-timeout');
  }

  @Get('achievement/profile-private')
  achievementProfilePrivate(): never {
    // Cross-module regression test: the prior per-module filter also
    // caught `UserProfilePrivateError` from the user module via
    // `@Catch(AchievementDomainError, UserProfilePrivateError)`. After
    // Phase 2 the achievement filter is removed; the global filter
    // handles `UserProfilePrivateError` via its Phase-1 mapping entry
    // (`USER_PROFILE_PRIVATE` → 403). This endpoint verifies that the
    // cross-module throwing path still routes correctly without the
    // achievement filter.
    throw new UserProfilePrivateError('user-target-1');
  }

  // Discussion-module endpoints — Phase 3.1 live-mapping coverage.
  // 12 concrete exceptions → 4 status codes (400/403/404/409). Each
  // endpoint throws a real discussion exception; if
  // `ProblemCodeMapping` or the discussion classes drift, the e2e
  // tests in the discussion describe-block below fail.
  //
  // Special note: the prior per-module filter
  // `DiscussionDomainExceptionFilter` used `exception.name` as a
  // lookup key into `STATUS_MAP` and `DISCUSSION_PROBLEM_URIS`. After
  // Phase 3.1 the lookup tables are replaced with `ProblemCodeMapping`
  // entries keyed by `code`. `title` changes from the class name
  // (e.g. `'ThreadNotFoundError'`) to the standard RFC 7807 title
  // (e.g. `'NotFound'`). This is verified per-row below.

  @Get('discussion/thread-not-found')
  discussionThreadNotFound(): never {
    throw new ThreadNotFoundError('thread-1');
  }

  @Get('discussion/comment-not-found')
  discussionCommentNotFound(): never {
    throw new CommentNotFoundError('comment-1');
  }

  @Get('discussion/thread-forbidden')
  discussionThreadForbidden(): never {
    throw new ThreadForbiddenError();
  }

  @Get('discussion/comment-forbidden')
  discussionCommentForbidden(): never {
    throw new CommentForbiddenError();
  }

  @Get('discussion/thread-closed')
  discussionThreadClosed(): never {
    throw new ThreadClosedError();
  }

  @Get('discussion/thread-not-active')
  discussionThreadNotActive(): never {
    throw new ThreadNotActiveError();
  }

  @Get('discussion/comment-thread-mismatch')
  discussionCommentThreadMismatch(): never {
    // Plan §8.4.1 risk note: 400 (non-obvious — one might expect 409
    // Conflict for a cross-resource mismatch). The migration test
    // captures this. `title` here is the standard `'BadRequest'` not
    // the class name.
    throw new CommentThreadMismatchError();
  }

  @Get('discussion/self-vote')
  discussionSelfVote(): never {
    throw new SelfVoteError();
  }

  @Get('discussion/self-report')
  discussionSelfReport(): never {
    throw new SelfReportError();
  }

  @Get('discussion/duplicate-report')
  discussionDuplicateReport(): never {
    throw new DuplicateReportError();
  }

  @Get('discussion/quiz-not-found')
  discussionQuizNotFound(): never {
    // This is the discussion-module version of `QuizNotFoundError`.
    // It uses `DISCUSSION_QUIZ_NOT_FOUND` (not `QUIZ_NOT_FOUND`).
    // The class-name collision with the quiz-module version is
    // documented at §9 item 1.
    throw new DiscussionQuizNotFoundError('quiz-1');
  }

  @Get('discussion/moderator-required')
  discussionModeratorRequired(): never {
    // Plan §8.4.1 risk note: 403 (non-obvious — the class name
    // suggests 401 or 403 for "auth required", but the actual
    // semantic is "you're authenticated but lack the moderator
    // role"). The migration test captures this.
    throw new ModeratorRequiredError();
  }

  // Ranking-module endpoints — Phase 3.2 live-mapping coverage.
  // 3 concrete exceptions → 2 status codes (422 + 500). Each
  // endpoint throws a real ranking exception; if
  // `ProblemCodeMapping` or the ranking classes drift, the e2e
  // tests in the ranking describe-block below fail.
  //
  // Special note: this is the highest-risk Phase-3 conversion
  // because the prior per-module filter was a `@Catch()` catch-all
  // that shadows `GlobalExceptionFilter`. After Phase 3.2 the
  // catch-all is removed; the global filter handles all errors via
  // `ProblemCodeMapping` (the 3 concrete exceptions) or via its
  // standard `HttpException` / uncaught `Error` paths. The
  // uncaught-error regression test below verifies that an artificial
  // `throw new Error('boom')` inside a ranking controller produces
  // a 500 with the standard RFC 7807 shape (a plan §8.4.2 completion
  // criterion).

  @Get('ranking/invalid-xp-event')
  rankingInvalidXpEvent(): never {
    // Status upgrade 500 → 422 (semantic correction): rejected XP
    // event input is unprocessable, not an internal server
    // failure.
    throw new InvalidXpEventError({ userId: 'u-1', amount: -5 }, 'Amount must be positive');
  }

  @Get('ranking/rank-calculation-error')
  rankingRankCalculationError(): never {
    // 500 with the actual thrown message preserved (prior filter
    // discarded the message and emitted a hardcoded `'Internal
    // server error'` envelope).
    throw new RankCalculationError('daily', 'db deadlock');
  }

  @Get('ranking/period-reset-error')
  rankingPeriodResetError(): never {
    // 500 with the actual thrown message preserved (prior filter
    // discarded the message).
    throw new PeriodResetError('weekly', 'scheduler offline');
  }

  @Get('ranking/uncaught-error')
  rankingUncaughtError(): never {
    // Plan §8.4.2 completion criterion: "an artificial `throw new
    // Error('boom')` inside a ranking controller produces a 500
    // with the standard shape." Before Phase 3.2 this error was
    // caught by `RankingDomainExceptionFilter`'s `@Catch()` and
    // emitted as `{ statusCode: 500, message: 'boom', code:
    // 'INTERNAL_ERROR', timestamp: '...' }`. After Phase 3.2 the
    // global filter handles it as canonical RFC 7807.
    throw new Error('boom');
  }

  @Get('http-not-found')
  httpNotFound(): never {
    throw new NotFoundException('Plain route does not exist.');
  }

  @Get('http-bad-request-validation')
  httpBadRequestValidation(): never {
    // Shape produced by NestJS ValidationPipe (string[] of error messages).
    throw new BadRequestException(['title must be a string', 'title must not be empty']);
  }

  // Notification-module endpoints — Phase 5 (rev5.1) missed-module
  // coverage. The notification module was inadvertently skipped in
  // Phases 1-3 because it had no per-module filter (no
  // `NotificationDomainExceptionFilter` to delete). Its errors
  // extended `Error` directly, so the global filter caught them via
  // its `instanceof Error` branch and returned 500 with `title:
  // 'InternalServerError'` — masking a legitimate 404 as a generic
  // 500. Phase 5 (rev5.1) converts them to `BaseDomainException`
  // subclasses; the global filter now resolves the correct status +
  // `extensions.code` for both. 2 concrete exceptions → 2 status
  // codes (404 + 403).
  @Get('notification/not-found')
  notificationNotFound(): never {
    // Status correction 500 → 404. Wire-shape improvement: prior
    // behavior emitted a misleading 500 (the thrown message was
    // preserved but the status was wrong — the global filter's
    // `instanceof Error` branch routed to 500 regardless of the
    // exception's intent). After Phase 5 (rev5.1) the global filter
    // resolves `NOTIFICATION_NOT_FOUND` → 404 via `ProblemCodeMapping`.
    throw new NotificationNotFoundError('notif-1');
  }

  @Get('notification/forbidden')
  notificationForbidden(): never {
    // Status correction 500 → 403. Same rationale as above. The
    // throw-site is post-authentication (the caller IS logged in,
    // they just don't own this notification), so 403 is correct.
    throw new NotificationForbiddenError();
  }

  @Get('plain-error')
  plainError(): never {
    throw new Error('boom');
  }

  @Get('non-error-throw')
  nonErrorThrow(): never {
    // The global filter must not crash on non-Error throwables (e.g. a
    // promise rejection with a string). This path is intentionally a
    // language-level violation — see the e2e test description above.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw 'a non-error throwable';
  }

  // Sanity: a path that returns 200 so the backstop can be sure it is
  // exercising the filter (and not just a 404 from an unrouted path).
  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }
}

describe('RFC 7807 ProblemDetail (Phase 0 backstop)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const silentLogger = {
      // The filter's contract is `warn` + `error`; provide no-op stubs.
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    } as unknown as PinoLogger;

    // Boot only ConfigModule with the `serverConfig` namespace so the filter's
    // `@Inject(serverConfig.KEY)` resolves. We deliberately skip env-file
    // loading, env validation, and other config namespaces — the e2e fixture
    // must run without Postgres / Redis / a `.env` file present.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: false,
          // No `validate` — env validation is exercised in unit tests, not here.
          load: [serverConfig],
        }),
      ],
      controllers: [Rfc7807FixtureController],
      providers: [
        {
          provide: PinoLogger,
          useValue: silentLogger,
        },
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('sanity', () => {
    it('does not intercept successful responses', async () => {
      const res = await request(app.getHttpServer()).get('/rfc7807-fixture/ok').expect(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('BaseDomainException (mapping-lookup path)', () => {
    it('renders the canonical ProblemDetail shape; status resolution lands in Phase 1', async () => {
      // Phase 0 acceptance (per plan §8.1 completion criteria):
      //   - Files exist on `main`
      //   - Build passes
      //   - All existing tests pass
      //   - `test/e2e/rfc7807.spec.ts` runs against the current code
      //
      // At Phase 0, the global filter does NOT yet perform
      // `code → status` mapping; that lands in Phase 1 alongside the
      // `ProblemCodeMapping` table. So a concrete `BaseDomainException`
      // falls through the filter's `instanceof Error` branch and surfaces
      // as a 500 with the class name as the title. The fixture pins
      // exactly that current behavior so the backstop is green from day 1.
      //
      // What Phase 0 IS asserting (per §4.3, property 1 — single `catch` site):
      //   - Every domain exception flows through the global filter.
      //   - The wire shape is the canonical ProblemDetail.
      //   - `extensions.requestId` is unconditional (key always present).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/domain-not-found')
        .expect(500);

      const body = res.body as ProblemWire;

      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      // The current global filter (Phase 0, pre-mapping) treats a
      // `BaseDomainException` as a plain `Error` and surfaces a fixed
      // `'InternalServerError'` title. Phase 1 swaps this for
      // `ProblemCodeMapping[exception.code].title` once the table exists.
      expect(body.title).toBe('InternalServerError');
      expect(body.status).toBe(500);
      expect(body.detail).toBe("Fixture 'abc-123' was not found.");
      expect(body.instance).toBe('/rfc7807-fixture/domain-not-found');

      // extensions.requestId is unconditional (per plan §4.3).
      // In this fixture there is no CorrelationInterceptor, so `request.id`
      // is `undefined` and JSON serialization drops the key from the wire
      // (a standard `JSON.stringify` quirk: `{ x: undefined }` → `{}`).
      // The unit test added in Phase 1 asserts the *source object* contains
      // the `requestId` key regardless. Here we just assert `extensions` is
      // an object — the source contract is that the key is *always present
      // before serialization*, which is what the Phase 1 unit test pins.
      expect(body.extensions).toBeDefined();
      expect(typeof body.extensions).toBe('object');
    });
  });

  describe('native HttpException (status-based path)', () => {
    it('renders 404 for NotFoundException', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/http-not-found')
        .expect(404);

      const body = res.body as ProblemWire;

      expect(body.type).toBe('https://api.quiz.local/problems/not-found');
      expect(body.status).toBe(404);
      // NestJS `NotFoundException` serializes to `{ error: 'Not Found', ... }`;
      // the global filter prefers `response.error` over `exception.name`.
      expect(body.title).toBe('Not Found');
      expect(body.detail).toBe('Plain route does not exist.');
      expect(body.instance).toBe('/rfc7807-fixture/http-not-found');
      expect(body.extensions).toBeDefined();
    });

    it('renders 400 for BadRequestException with a string-array message (ValidationPipe shape)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/http-bad-request-validation')
        .expect(400);

      const body = res.body as ProblemWire;

      expect(body.type).toBe('https://api.quiz.local/problems/bad-request');
      expect(body.status).toBe(400);
      // Same convention: NestJS emits `error: 'Bad Request'`.
      expect(body.title).toBe('Bad Request');
      // ValidationPipe yields a string[]; the global filter joins with '; '.
      expect(body.detail).toBe('title must be a string; title must not be empty');
      expect(body.instance).toBe('/rfc7807-fixture/http-bad-request-validation');
      expect(body.extensions).toBeDefined();
    });
  });

  describe('plain Error (uncaught path)', () => {
    it('renders 500 with the developer-mode message (production-mode policy is covered by the unit test)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/plain-error')
        .expect(500);

      const body = res.body as ProblemWire;

      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      expect(body.status).toBe(500);
      expect(body.title).toBe('InternalServerError');
      // The fixture runs with `nodeEnv = 'development'` (the `serverConfig`
      // default), so the developer-mode message is surfaced here. Production
      // sanitization is covered by the unit test added in Phase 1.
      expect(body.detail).toBe('boom');
      expect(body.instance).toBe('/rfc7807-fixture/plain-error');
      expect(body.extensions).toBeDefined();
    });
  });

  describe('non-Error throwable', () => {
    it('renders 500 without crashing the filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/non-error-throw')
        .expect(500);

      const body = res.body as ProblemWire;

      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      expect(body.status).toBe(500);
      // Non-error throwables fall through to the same fallback title.
      expect(body.title).toBe('InternalServerError');
      expect(body.extensions).toBeDefined();
    });
  });

  describe('Auth-module exceptions (Phase 1 — live mapping through the global filter)', () => {
    // Phase 0's `FixtureNotFoundError` uses a code NOT in `ProblemCodeMapping`
    // and exercises the loud-failure branch. This block exercises the
    // *resolved* path: a real auth exception whose `code` resolves in
    // the mapping table and produces the canonical ProblemDetail wire shape.
    //
    // Each test asserts:
    //   - status code matches the mapping
    //   - title matches the mapping
    //   - typeUri matches the mapping (the per-module, not the generic URI)
    //   - extensions.code matches the class's `code` field
    //
    // If any of these fail, the migration is broken: either the exception's
    // `code` field drifted, or `ProblemCodeMapping` drifted, or the global
    // filter's resolution path drifted.

    it('InvalidCredentialsError → 401 AUTH_INVALID_CREDENTIALS', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/invalid-credentials')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/auth-invalid-credentials');
      expect(body.title).toBe('Unauthorized');
      expect(body.extensions?.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('InvalidRefreshTokenError → 401 AUTH_INVALID_REFRESH_TOKEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/invalid-refresh-token')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('TokenReuseDetectedError → 401 AUTH_TOKEN_REUSED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/token-reused')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_TOKEN_REUSED');
    });

    it('SessionContextMismatchError → 401 AUTH_SESSION_CONTEXT_MISMATCH', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/session-context-mismatch')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_SESSION_CONTEXT_MISMATCH');
    });

    it('UserNotFoundError (auth variant) → 401 AUTH_USER_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/user-not-found')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_USER_NOT_FOUND');
    });

    it('RateLimitExceededError → 429 AUTH_RATE_LIMITED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/rate-limited')
        .expect(429);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/auth-rate-limited');
      expect(body.title).toBe('TooManyRequests');
      expect(body.extensions?.code).toBe('AUTH_RATE_LIMITED');
    });

    it('ResourceConflictError → 409 AUTH_RESOURCE_CONFLICT (was a 500 fall-through before Phase 1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/resource-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_RESOURCE_CONFLICT');
    });

    it('SessionNotFoundError → 404 AUTH_SESSION_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/session-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/auth-session-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('AUTH_SESSION_NOT_FOUND');
    });

    it('InvalidTokenError → 400 AUTH_INVALID_TOKEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/invalid-token')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_INVALID_TOKEN');
    });

    it('InvalidPasswordError → 401 AUTH_INVALID_CURRENT_PASSWORD', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/invalid-current-password')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_INVALID_CURRENT_PASSWORD');
    });

    it('DeletionFailedError → 409 AUTH_DELETION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/deletion-failed')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_DELETION_FAILED');
    });

    it('PasswordReuseError → 409 AUTH_PASSWORD_REUSE (preserves the thrown message verbatim)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/password-reuse')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_PASSWORD_REUSE');
      // Per the prior filter's behavior: `PasswordReuseError.detail =
      // error.message` (the thrown message is preserved verbatim, not
      // replaced by a generic string). The new global filter also
      // preserves `exception.message`.
      expect(body.detail).toBe(
        'Password has been used recently. Please choose a different password.',
      );
    });

    it('InvalidOAuthTokenError → 401 AUTH_OAUTH_INVALID_TOKEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/auth/oauth-invalid-token')
        .expect(401);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('AUTH_OAUTH_INVALID_TOKEN');
    });
  });

  describe('Quiz-module exceptions (Phase 1 — live mapping through the global filter)', () => {
    // Phase 0 covers the global filter's behavior with synthetic exceptions;
    // this block exercises the *resolved* path: real quiz exceptions
    // whose `code` resolves in `ProblemCodeMapping`. Each test pins the
    // full wire shape (status, title, typeUri, extensions.code).

    it('QuizNotFoundError → 404 QUIZ_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/quiz-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('QUIZ_NOT_FOUND');
    });

    it('QuizForbiddenError → 403 QUIZ_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.extensions?.code).toBe('QUIZ_FORBIDDEN');
    });

    it('QuizSlugConflictError → 409 QUIZ_SLUG_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/slug-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/quiz-slug-conflict');
      expect(body.extensions?.code).toBe('QUIZ_SLUG_CONFLICT');
    });

    it('QuizConflictError → 409 QUIZ_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('QUIZ_CONFLICT');
    });

    it('QuizValidationError → 400 QUIZ_VALIDATION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/validation-failed')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.extensions?.code).toBe('QUIZ_VALIDATION_FAILED');
    });

    it('QuizVersionImmutableError → 400 QUIZ_VERSION_IMMUTABLE (detail is preserved from exception.message)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/version-immutable')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/quiz-version-immutable');
      expect(body.extensions?.code).toBe('QUIZ_VERSION_IMMUTABLE');
      // Wire-shape improvement: the prior per-module filter hardcoded
      // `detail: 'This quiz version cannot be modified'`. The new global
      // filter preserves `exception.message`, so a default-constructed
      // exception still surfaces that default string (the state-machine
      // callsites override with their own specific message).
      expect(body.detail).toBe('This quiz version cannot be modified');
    });

    it('QuizInsufficientQuestionsError → 422 QUIZ_INSUFFICIENT_QUESTIONS', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/insufficient-questions')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.type).toBe('https://api.quiz.local/problems/quiz-insufficient-questions');
      expect(body.extensions?.code).toBe('QUIZ_INSUFFICIENT_QUESTIONS');
    });

    it('QuizQuestionPositionConflictError → 409 QUIZ_QUESTION_POSITION_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/question-position-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('QUIZ_QUESTION_POSITION_CONFLICT');
    });

    it('QuizAnswerOptionPositionConflictError → 409 QUIZ_ANSWER_OPTION_POSITION_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/answer-option-position-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('QUIZ_ANSWER_OPTION_POSITION_CONFLICT');
    });

    it('QuizMultipleCorrectOptionsError → 400 QUIZ_MULTIPLE_CORRECT_OPTIONS', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/multiple-correct-options')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('QUIZ_MULTIPLE_CORRECT_OPTIONS');
    });

    it('QuizOperationFailedError → 500 QUIZ_OPERATION_FAILED (unmapped-DB catch-all)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/operation-failed')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.type).toBe('https://api.quiz.local/problems/quiz-operation-failed');
      expect(body.extensions?.code).toBe('QUIZ_OPERATION_FAILED');
    });

    it('QuizAnalyticsNotFoundError → 404 QUIZ_ANALYTICS_NOT_FOUND (was a 500 fall-through before Phase 1)', async () => {
      // Wire-shape improvement: prior setup had no `@Catch(QuizAnalyticsError)`
      // filter, so analytics errors fell through to GlobalExceptionFilter's
      // plain-Error branch and surfaced as 500. The comment in
      // `quiz-review.controller.ts` documented the *intended* behavior as
      // 404. After Phase 1 the wire shape matches the intent.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/analytics-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/quiz-analytics-not-found');
      expect(body.extensions?.code).toBe('QUIZ_ANALYTICS_NOT_FOUND');
      expect(body.detail).toBe('Quiz not found: quiz-xyz');
    });

    it('AnalyticsCalculationError → 500 QUIZ_ANALYTICS_CALCULATION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/quiz/analytics-calculation-failed')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('QUIZ_ANALYTICS_CALCULATION_FAILED');
      // `AnalyticsCalculationError` prefixes its message: `Analytics calculation failed: <inner>`.
      expect(body.detail).toBe('Analytics calculation failed: divide by zero');
    });
  });

  describe('Attempt-module exceptions (Phase 1 — live mapping through the global filter)', () => {
    // Each test pins the wire shape (status, title, typeUri,
    // extensions.code) for a real attempt exception flowing through the
    // global filter. The mapping table is the single source of truth for
    // HTTP-level metadata; if it drifts, these tests fail.

    it('AttemptNotFoundError → 404 ATTEMPT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/attempt-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('ATTEMPT_NOT_FOUND');
    });

    it('AttemptForbiddenError → 403 ATTEMPT_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.extensions?.code).toBe('ATTEMPT_FORBIDDEN');
    });

    it('AttemptValidationError → 400 ATTEMPT_VALIDATION_FAILED (standalone class, no children)', async () => {
      // After Phase 1, `AttemptValidationError` is a concrete standalone
      // class — its former 3 children (`QuizNotPublishedError`,
      // `AttemptQuestionInvalidError`, `AttemptNotCompletedError`) extend
      // `AttemptDomainError` directly and have their own codes. The
      // 400 BadRequest mapping is reserved for the one direct throw site
      // in `attempt-command.service.ts` (option-related validation).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/validation-failed')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.type).toBe('https://api.quiz.local/problems/attempt-validation-failed');
      expect(body.extensions?.code).toBe('ATTEMPT_VALIDATION_FAILED');
    });

    it('AttemptAlreadyStartedError → 409 ATTEMPT_ALREADY_STARTED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/already-started')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('ATTEMPT_ALREADY_STARTED');
    });

    it('AttemptNotActiveError → 409 ATTEMPT_NOT_ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/not-active')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('ATTEMPT_NOT_ACTIVE');
    });

    it('AttemptQuestionAlreadyAnsweredError → 409 ATTEMPT_QUESTION_ALREADY_ANSWERED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/question-already-answered')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('ATTEMPT_QUESTION_ALREADY_ANSWERED');
    });

    it('QuizNotPublishedError (attempt variant) → 422 ATTEMPT_QUIZ_NOT_PUBLISHED (was a 400 fall-through before Phase 1)', async () => {
      // Wire-shape upgrade: in the prior module structure,
      // `QuizNotPublishedError` extended `AttemptValidationError` and
      // inherited its 400 mapping. After Phase 1 it extends
      // `AttemptDomainError` directly and resolves to 422 — a deliberate
      // upgrade because the request is syntactically valid; only the
      // resource state (unpublished) forbids the action.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/quiz-not-published')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.type).toBe('https://api.quiz.local/problems/attempt-quiz-not-published');
      expect(body.extensions?.code).toBe('ATTEMPT_QUIZ_NOT_PUBLISHED');
    });

    it('AttemptQuestionInvalidError → 422 ATTEMPT_QUESTION_INVALID (was a 400 fall-through before Phase 1)', async () => {
      // Same wire-shape upgrade rationale as QuizNotPublishedError.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/question-invalid')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.extensions?.code).toBe('ATTEMPT_QUESTION_INVALID');
    });

    it('AttemptNotCompletedError → 422 ATTEMPT_NOT_COMPLETED (was a 400 fall-through before Phase 1)', async () => {
      // Same wire-shape upgrade rationale as QuizNotPublishedError.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/not-completed')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.type).toBe('https://api.quiz.local/problems/attempt-not-completed');
      expect(body.extensions?.code).toBe('ATTEMPT_NOT_COMPLETED');
    });

    it('AttemptAnswerNotFoundError → 404 ATTEMPT_ANSWER_NOT_FOUND (dead-code class with sensible mapping)', async () => {
      // This class is exported but never thrown anywhere in the
      // codebase. It is preserved with a 404 mapping (semantic analogue
      // to AttemptNotFoundError) so that if a future call site starts
      // throwing it, the wire shape is already verified.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/answer-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/attempt-answer-not-found');
      expect(body.extensions?.code).toBe('ATTEMPT_ANSWER_NOT_FOUND');
    });
  });

  describe('User-module exceptions (Phase 1 — live mapping through the global filter)', () => {
    // Each test pins the wire shape (status, title, typeUri,
    // extensions.code) for a real user exception flowing through the
    // global filter. The mapping table is the single source of truth
    // for HTTP-level metadata; if it drifts, these tests fail.

    it('UserNotFoundError (user variant) → 404 USER_NOT_FOUND', async () => {
      // Distinct from `AUTH_USER_NOT_FOUND` (401): the user variant
      // surfaces from the user module's read paths; the auth variant
      // surfaces from auth-flow services (refresh-token, password-change,
      // account-security). Both classes exist with the same name and
      // different module identities. Unification deferred per plan §9
      // item 1.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/user-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('USER_NOT_FOUND');
    });

    it('UserNotFoundError preserves thrown message verbatim (wire-shape improvement)', async () => {
      // Wire-shape improvement: the prior per-module filter hardcoded
      // `detail: 'User not found'` for `UserNotFoundError`, ignoring
      // `error.message`. Call sites that threw
      // `new UserNotFoundError('User not found or already deleted')`
      // saw the generic message on the wire. The new global filter
      // preserves `exception.message`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/not-found-with-message')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.detail).toBe('User not found or already deleted');
      expect(body.extensions?.code).toBe('USER_NOT_FOUND');
    });

    it('UserRankingNotFoundError → 404 USER_RANKING_NOT_FOUND (dead-code class with sensible mapping)', async () => {
      // This class is exported but never thrown in the current
      // codebase. It is preserved with a 404 mapping (semantic
      // analogue to `UserNotFoundError`).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/ranking-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/user-ranking-not-found');
      expect(body.extensions?.code).toBe('USER_RANKING_NOT_FOUND');
    });

    it('UserAnalyticsNotFoundError → 404 USER_ANALYTICS_NOT_FOUND (dead-code class with sensible mapping)', async () => {
      // Dead-code class — exported but never thrown. Preserved with a
      // sensible 404 mapping.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/analytics-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/user-analytics-not-found');
      expect(body.extensions?.code).toBe('USER_ANALYTICS_NOT_FOUND');
    });

    it('UserProfilePrivateError → 403 USER_PROFILE_PRIVATE (message built from targetUserId)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/profile-private')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.type).toBe('https://api.quiz.local/problems/user-profile-private');
      expect(body.extensions?.code).toBe('USER_PROFILE_PRIVATE');
      // `UserProfilePrivateError` builds its message from the
      // `targetUserId` arg: `Profile of user <id> is not public`.
      expect(body.detail).toBe('Profile of user user-abc is not public');
    });
  });

  describe('Category-module exceptions (Phase 2 — first legacy → RFC 7807 conversion)', () => {
    // Phase 1 covered modules that already emitted RFC 7807 (just gained
    // `extensions.code`). Phase 2 covers modules that *previously* emitted
    // the legacy `{ statusCode, message, error }` envelope. The category
    // module is the first Phase-2 module migrated.
    //
    // These tests pin the full wire shape (status, title, typeUri,
    // extensions.code) for each migrated category exception. The previous
    // envelope shape (`{ statusCode: 404, message: 'Category not found',
    // error: 'Not Found' }`) is gone entirely — clients reading
    // `err.response.data.statusCode` will break; clients reading
    // `err.response.data.status` (or `extensions.code`) continue to work
    // with a richer payload. The `LEGACY_COMPAT` shim is deferred to a
    // separate PR per plan §8.3.
    //
    // Same shape as the Phase-1 module tests, but every wire field listed
    // below is NEW (no envelope continuity with the prior per-module
    // filter).

    it('CategoryNotFoundError → 404 CATEGORY_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/category/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/category-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Category not found');
      expect(body.extensions?.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('CategoryAnalyticsNotFoundError → 404 CATEGORY_ANALYTICS_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/category/analytics-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('CATEGORY_ANALYTICS_NOT_FOUND');
    });

    it('CategorySlugConflictError → 409 CATEGORY_SLUG_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/category/slug-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('CATEGORY_SLUG_CONFLICT');
    });

    it('CategoryAlreadyActiveError → 409 CATEGORY_ALREADY_ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/category/already-active')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('CATEGORY_ALREADY_ACTIVE');
    });

    it('CategoryRestoreInvariantError → 500 CATEGORY_RESTORE_INVARIANT (wire-shape improvement)', async () => {
      // Wire-shape improvement: the prior per-module filter returned
      // `{ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }`.
      // The global filter now surfaces the concrete message:
      // `'Category restore invariant violated'`. The status code is
      // unchanged (500). Clients switching on `extensions.code` get a
      // precise classification that was previously absent.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/category/restore-invariant')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/category-restore-invariant');
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Category restore invariant violated');
      expect(body.extensions?.code).toBe('CATEGORY_RESTORE_INVARIANT');
    });
  });

  describe('Tag-module exceptions (Phase 2 — second legacy → RFC 7807 conversion)', () => {
    // Structurally identical to the category describe-block above. The
    // same wire-shape-change caveats apply (envelope replacement,
    // `LEGACY_COMPAT` shim deferred). Kept as a separate describe block
    // so failure signals from the two modules don't interleave.

    it('TagNotFoundError → 404 TAG_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tag/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/tag-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Tag not found');
      expect(body.extensions?.code).toBe('TAG_NOT_FOUND');
    });

    it('TagAnalyticsNotFoundError → 404 TAG_ANALYTICS_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tag/analytics-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('TAG_ANALYTICS_NOT_FOUND');
    });

    it('TagSlugConflictError → 409 TAG_SLUG_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tag/slug-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('TAG_SLUG_CONFLICT');
    });

    it('TagAlreadyActiveError → 409 TAG_ALREADY_ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tag/already-active')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('TAG_ALREADY_ACTIVE');
    });

    it('TagRestoreInvariantError → 500 TAG_RESTORE_INVARIANT (wire-shape improvement)', async () => {
      // Wire-shape improvement: the prior per-module filter returned
      // `{ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }`.
      // The global filter now surfaces the concrete message:
      // `'Tag restore invariant violated'`. Status code unchanged (500).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tag/restore-invariant')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/tag-restore-invariant');
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Tag restore invariant violated');
      expect(body.extensions?.code).toBe('TAG_RESTORE_INVARIANT');
    });
  });

  describe('Tournament-module exceptions (Phase 2 — third legacy → RFC 7807 conversion)', () => {
    // Largest Phase-2 module by class count. 15 exceptions → 4 status
    // codes (400/403/404/409). One of the 15
    // (TournamentAlreadyWithdrawnError) was previously mapped to 500
    // via the filter's default branch — Phase 2 fixes that to 409.
    //
    // The first module in Phase 2 with an existing `*DomainErrorDto`
    // Swagger DTO to delete (per §8.3 completion criteria).
    //
    // The per-module `tournamentForbiddenResponse` helper documents
    // 403s using the RFC 7807 ProblemDetailDto type — verified by the
    // `TOURNAMENT_FORBIDDEN` assertion below. The `oneOf` references
    // (4 inline + 1 in `tournamentForbiddenResponse`) are all
    // simplified to `ProblemDetailDto` alone.

    it('TournamentNotFoundError → 404 TOURNAMENT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('TOURNAMENT_NOT_FOUND');
    });

    it('TournamentRoundNotFoundError → 404 TOURNAMENT_ROUND_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/round-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_ROUND_NOT_FOUND');
    });

    it('TournamentNotRegisteredError → 404 TOURNAMENT_NOT_REGISTERED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/not-registered')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_NOT_REGISTERED');
    });

    it('TournamentForbiddenError → 403 TOURNAMENT_FORBIDDEN (wire-shape improvement)', async () => {
      // Wire-shape improvement: the prior per-module filter rewrote
      // every `TournamentForbiddenError.message` to the generic
      // `'You do not have permission to perform this action'`, ignoring
      // the thrown message. The global filter now preserves
      // `exception.message`, so the thrown
      // `'You do not have permission to manage this tournament'`
      // surfaces on the wire.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to manage this tournament');
      expect(body.extensions?.code).toBe('TOURNAMENT_FORBIDDEN');
    });

    it('TournamentConflictError → 409 TOURNAMENT_CONFLICT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_CONFLICT');
    });

    it('TournamentAlreadyRegisteredError → 409 TOURNAMENT_ALREADY_REGISTERED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/already-registered')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_ALREADY_REGISTERED');
    });

    it('TournamentAttemptAlreadyExistsError → 409 TOURNAMENT_ATTEMPT_ALREADY_EXISTS', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/attempt-already-exists')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_ATTEMPT_ALREADY_EXISTS');
    });

    it('TournamentParticipantStateError → 409 TOURNAMENT_PARTICIPANT_STATE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/participant-state')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.detail).toBe('Participant is in unexpected state "withdrawn" for this operation');
      expect(body.extensions?.code).toBe('TOURNAMENT_PARTICIPANT_STATE');
    });

    it('TournamentAlreadyWithdrawnError → 409 TOURNAMENT_ALREADY_WITHDRAWN (was 500 in the prior filter)', async () => {
      // Wire-shape fix: prior filter fell through to 500 default for
      // this exception class. Phase 2 routes it to 409 (semantic
      // state conflict).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/already-withdrawn')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('TOURNAMENT_ALREADY_WITHDRAWN');
    });

    it('TournamentValidationError → 400 TOURNAMENT_VALIDATION', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/validation')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.extensions?.code).toBe('TOURNAMENT_VALIDATION');
    });

    it('TournamentRegistrationClosedError → 400 TOURNAMENT_REGISTRATION_CLOSED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/registration-closed')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_REGISTRATION_CLOSED');
    });

    it('TournamentFullError → 400 TOURNAMENT_FULL', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/full')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_FULL');
    });

    it('TournamentRoundNotOpenError → 400 TOURNAMENT_ROUND_NOT_OPEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/round-not-open')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_ROUND_NOT_OPEN');
    });

    it('TournamentUnregisterClosedError → 400 TOURNAMENT_UNREGISTER_CLOSED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/unregister-closed')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_UNREGISTER_CLOSED');
    });

    it('TournamentWithdrawClosedError → 400 TOURNAMENT_WITHDRAW_CLOSED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/tournament/withdraw-closed')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.extensions?.code).toBe('TOURNAMENT_WITHDRAW_CLOSED');
    });
  });

  describe('Review-module exceptions (Phase 2 — fourth legacy → RFC 7807 conversion)', () => {
    // 6 concrete exceptions → 4 status codes (400/403/404/409). Second
    // module in Phase 2 with an existing `*DomainErrorDto` Swagger DTO
    // to delete (the last is instance — see v4.5). The prior
    // per-module filter rewrote almost every exception's message to
    // a hardcoded generic. After Phase 2 the thrown message survives
    // — verified per-row below.

    it('ReviewNotFoundError → 404 REVIEW_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: 3 throw sites in `review.service.ts`
      // pass `'Quiz not found'`. The prior filter rewrote them to
      // `'Review not found'`. The global filter preserves the thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Quiz not found');
      expect(body.extensions?.code).toBe('REVIEW_NOT_FOUND');
    });

    it('ReviewForbiddenError → 403 REVIEW_FORBIDDEN (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to `'You do
      // not have permission to perform this action'`. Global filter
      // preserves thrown message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to manage this review');
      expect(body.extensions?.code).toBe('REVIEW_FORBIDDEN');
    });

    it('ReviewConflictError → 409 REVIEW_CONFLICT (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource already exists'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('You have already reviewed this quiz');
      expect(body.extensions?.code).toBe('REVIEW_CONFLICT');
    });

    it('ReviewValidationError → 400 REVIEW_VALIDATION (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/validation')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe('You cannot vote on your own review');
      expect(body.extensions?.code).toBe('REVIEW_VALIDATION');
    });

    it('ReviewAttemptRequiredError → 400 REVIEW_ATTEMPT_REQUIRED (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/attempt-required')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.detail).toBe('You must complete at least one attempt before reviewing this quiz');
      expect(body.extensions?.code).toBe('REVIEW_ATTEMPT_REQUIRED');
    });

    it('ReviewAlreadyReportedError → 409 REVIEW_ALREADY_REPORTED (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to `'You
      // have already reported this review'`. Global filter preserves
      // thrown message (which matches the prior hardcoded string by
      // default — verified here for completeness).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/already-reported')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('You have already reported this review');
      expect(body.extensions?.code).toBe('REVIEW_ALREADY_REPORTED');
    });
  });

  describe('Bookmark-module exceptions (Phase 2 — fifth legacy → RFC 7807 conversion)', () => {
    // 7 concrete exceptions → 4 status codes (400/403/404/409). Third
    // module with an existing `*DomainErrorDto` Swagger DTO to delete
    // (the last is instance — see v4.5+). The prior per-module filter
    // rewrote almost every exception's message to a hardcoded
    // generic. After Phase 2 the thrown message survives — verified
    // per-row below.

    it('BookmarkNotFoundError → 404 BOOKMARK_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource not found'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Bookmark not found');
      expect(body.extensions?.code).toBe('BOOKMARK_NOT_FOUND');
    });

    it('CollectionNotFoundError → 404 COLLECTION_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource not found'`. Global filter preserves thrown
      // message. One call site (`bookmark-command.service.ts:161`)
      // passes `'Quiz not found'` — verified here.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/collection-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Quiz not found');
      expect(body.extensions?.code).toBe('COLLECTION_NOT_FOUND');
    });

    it('BookmarkCollectionNotFoundError → 404 BOOKMARK_COLLECTION_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Bookmark collection analytics not found'`, even for throw
      // sites that passed distinct messages. Global filter preserves
      // thrown message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/analytics-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe(
        'Collection was deleted while processing this request. Please retry.',
      );
      expect(body.extensions?.code).toBe('BOOKMARK_COLLECTION_NOT_FOUND');
    });

    it('CollectionForbiddenError → 403 COLLECTION_FORBIDDEN (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to `'You do
      // not have permission to perform this action'`. Global filter
      // preserves thrown message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/collection-forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to manage this collection');
      expect(body.extensions?.code).toBe('COLLECTION_FORBIDDEN');
    });

    it('BookmarkConflictError → 409 BOOKMARK_CONFLICT (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource already exists'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('This quiz is already bookmarked in this collection');
      expect(body.extensions?.code).toBe('BOOKMARK_CONFLICT');
    });

    it('CollectionConflictError → 409 COLLECTION_CONFLICT (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource already exists'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/collection-conflict')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('A collection with this name already exists');
      expect(body.extensions?.code).toBe('COLLECTION_CONFLICT');
    });

    it('BookmarkValidationError → 400 BOOKMARK_VALIDATION (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/validation')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe('Bookmark validation failed');
      expect(body.extensions?.code).toBe('BOOKMARK_VALIDATION');
    });
  });

  describe('Instance-module exceptions (Phase 2 — sixth legacy → RFC 7807 conversion)', () => {
    // 7 concrete exceptions → 4 status codes (400/403/404/409). Fourth
    // module with an existing `*DomainErrorDto` Swagger DTO to delete
    // (completing §8.3's "No *DomainErrorDto files remain" criterion).
    // Most complex Phase-2 conversion so far: TWO filters in the module
    // (HTTP + WS), `oneOf` schema simplification in the controller, and
    // one exception (`PlayerAlreadyJoinedError`) defined but not
    // currently thrown.
    //
    // The prior per-module HTTP filter rewrote almost every
    // exception's message to a hardcoded generic. After Phase 2 the
    // thrown message survives — verified per-row below.

    it('InstanceNotFoundError → 404 INSTANCE_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource not found'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Quiz instance not found');
      expect(body.extensions?.code).toBe('INSTANCE_NOT_FOUND');
    });

    it('InstanceNotHostError → 403 INSTANCE_NOT_HOST (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'You do not have permission to perform this action'`.
      // Global filter preserves thrown message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/not-host')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Only the host can perform this action');
      expect(body.extensions?.code).toBe('INSTANCE_NOT_HOST');
    });

    it('InstanceNotOpenError → 400 INSTANCE_NOT_OPEN (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/not-open')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe('Instance is not open for joining');
      expect(body.extensions?.code).toBe('INSTANCE_NOT_OPEN');
    });

    it('InstanceFullError → 400 INSTANCE_FULL (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/full')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe('Instance is full');
      expect(body.extensions?.code).toBe('INSTANCE_FULL');
    });

    it('InstanceAlreadyStartedError → 400 INSTANCE_ALREADY_STARTED (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/already-started')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.detail).toBe('Instance has already started');
      expect(body.extensions?.code).toBe('INSTANCE_ALREADY_STARTED');
    });

    it('InstanceAlreadyClosedError → 400 INSTANCE_ALREADY_CLOSED (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Invalid request data'`. Global filter preserves thrown
      // message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/already-closed')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.detail).toBe('Instance is already closed');
      expect(body.extensions?.code).toBe('INSTANCE_ALREADY_CLOSED');
    });

    it('PlayerAlreadyJoinedError → 409 PLAYER_ALREADY_JOINED (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Resource already exists'`. Global filter preserves thrown
      // message. Note: this exception is defined but currently not
      // thrown by `instance.service.ts` — see docblock on
      // `PlayerAlreadyJoinedError`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/instance/player-already-joined')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('You have already joined this instance');
      expect(body.extensions?.code).toBe('PLAYER_ALREADY_JOINED');
    });
  });

  describe('Social-module exceptions (Phase 2 — seventh legacy → RFC 7807 conversion)', () => {
    // 8 concrete exceptions → 4 status codes (400/403/404/409). No
    // `*DomainErrorDto` Swagger DTO exists in this module (verified by
    // grep — social never had one). The single controller already
    // uses `ApiAuthAction` / `ApiAuthActionNoContent` shorthand
    // decorators that cover all 4 error responses — so the controller
    // migration is the simplest possible: just remove `@UseFilters`.
    //
    // The prior per-module HTTP filter preserved most thrown messages
    // verbatim — the two notable exceptions are documented per-row
    // below.

    it('FriendRequestNotFoundError → 404 SOCIAL_FRIEND_REQUEST_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter dropped the request ID
      // and rewrote all to `'Friend request not found'`. Global
      // filter preserves thrown message including the interpolated
      // ID.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/friend-request-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Friend request not found: abc-123');
      expect(body.extensions?.code).toBe('SOCIAL_FRIEND_REQUEST_NOT_FOUND');
    });

    it('FriendRequestForbiddenError → 403 SOCIAL_FRIEND_REQUEST_FORBIDDEN (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'You do not have permission to perform this action'`.
      // Global filter preserves thrown message.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/friend-request-forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to respond to this friend request');
      expect(body.extensions?.code).toBe('SOCIAL_FRIEND_REQUEST_FORBIDDEN');
    });

    it('FriendListForbiddenError → 403 SOCIAL_FRIEND_LIST_FORBIDDEN (message preserved verbatim)', async () => {
      // Prior filter preserved this message verbatim; behavior
      // unchanged. Verifies mapping resolves to 403.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/friend-list-forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to view this user\u2019s friend list');
      expect(body.extensions?.code).toBe('SOCIAL_FRIEND_LIST_FORBIDDEN');
    });

    it('SelfFriendRequestError → 400 SOCIAL_SELF_FRIEND_REQUEST (message preserved verbatim)', async () => {
      // Prior filter preserved this message verbatim; behavior
      // unchanged. Verifies mapping resolves to 400.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/self-friend-request')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe('You cannot send a friend request to yourself');
      expect(body.extensions?.code).toBe('SOCIAL_SELF_FRIEND_REQUEST');
    });

    it('AlreadyFriendsError → 409 SOCIAL_ALREADY_FRIENDS (message preserved verbatim)', async () => {
      // Prior filter preserved this message verbatim; behavior
      // unchanged. Verifies mapping resolves to 409.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/already-friends')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('You are already friends with this user');
      expect(body.extensions?.code).toBe('SOCIAL_ALREADY_FRIENDS');
    });

    it('BlockedUserError → 403 SOCIAL_BLOCKED_USER (message preserved verbatim)', async () => {
      // Prior filter preserved this message verbatim; behavior
      // unchanged. Verifies mapping resolves to 403.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/blocked-user')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Cannot perform this action on a blocked user');
      expect(body.extensions?.code).toBe('SOCIAL_BLOCKED_USER');
    });

    it('UserBlockedError → 403 SOCIAL_USER_BLOCKED (message preserved verbatim)', async () => {
      // Prior filter preserved this message verbatim; behavior
      // unchanged. Verifies mapping resolves to 403.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/user-blocked')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('This user has blocked you');
      expect(body.extensions?.code).toBe('SOCIAL_USER_BLOCKED');
    });

    it('PendingRequestExistsError → 409 SOCIAL_PENDING_REQUEST_EXISTS (message preserved verbatim)', async () => {
      // Prior filter preserved this message verbatim; behavior
      // unchanged. Verifies mapping resolves to 409.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/social/pending-request-exists')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('A friend request is already pending');
      expect(body.extensions?.code).toBe('SOCIAL_PENDING_REQUEST_EXISTS');
    });
  });

  describe('Achievement-module exceptions (Phase 2 — eighth and final legacy → RFC 7807 conversion)', () => {
    // 4 concrete exceptions → 2 status codes (404 + 500). Distinct
    // from prior Phase-2 modules (most have 4 status codes) because
    // `AchievementGrantError` is a 500-class rule-engine grant failure.
    // The cross-module `@Catch` (AchievementDomainError,
    // UserProfilePrivateError) → `UserProfilePrivateError` (Phase 1)
    // regression test verifies that the global filter handles
    // achievement-route-thrown `UserProfilePrivateError` correctly.
    //
    // The prior per-module HTTP filter:
    //   - rewrote `BadgeNotFoundError('Badge not found: <id>')` → `'Badge not found'`,
    //   - rewrote `AchievementUserNotFoundError('User not found: <id>')` → `'User not found'`,
    //   - rewrote `UserBadgeOwnershipNotFoundError('Badge <id> not owned by user <id>')` → `'User badge not found'`,
    //   - had NO branch for `AchievementGrantError` → 500 catch-all with `'Internal server error'`.
    // After Phase 2 the thrown message survives — verified per-row
    // below.

    it('BadgeNotFoundError → 404 BADGE_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'Badge not found'`. Global filter preserves thrown
      // message including the interpolated badge ID.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/badge-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Badge not found: badge-abc');
      expect(body.extensions?.code).toBe('BADGE_NOT_FOUND');
    });

    it('AchievementUserNotFoundError → 404 ACHIEVEMENT_USER_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'User not found'`. Global filter preserves thrown
      // message including the interpolated user ID.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/user-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('User not found: user-1');
      expect(body.extensions?.code).toBe('ACHIEVEMENT_USER_NOT_FOUND');
    });

    it('UserBadgeOwnershipNotFoundError → 404 USER_BADGE_OWNERSHIP_NOT_FOUND (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter rewrote all to
      // `'User badge not found'`. Global filter preserves thrown
      // message including both interpolated IDs.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/user-badge-ownership-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Badge badge-abc not owned by user user-1');
      expect(body.extensions?.code).toBe('USER_BADGE_OWNERSHIP_NOT_FOUND');
    });

    it('AchievementGrantError → 500 ACHIEVEMENT_GRANT_ERROR (wire-shape improvement)', async () => {
      // Wire-shape improvement: prior filter had NO branch for
      // `AchievementGrantError` — fell through to catch-all 500
      // with hardcoded `'Internal server error'`. Global filter
      // resolves the code and preserves the thrown message
      // including the user ID and reason. Note: this exception is
      // defined but currently not thrown by
      // `achievement.application.service.ts`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/grant-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Failed to grant achievement for user user-1: rule-engine-timeout');
      expect(body.extensions?.code).toBe('ACHIEVEMENT_GRANT_ERROR');
    });

    it('UserProfilePrivateError (cross-module) → 403 USER_PROFILE_PRIVATE (regression)', async () => {
      // Cross-module regression test: the prior per-module filter
      // also caught `UserProfilePrivateError` from the user module
      // via `@Catch(AchievementDomainError, UserProfilePrivateError)`.
      // After Phase 2 the achievement filter is removed; the global
      // filter handles `UserProfilePrivateError` via its Phase-1
      // mapping entry (`USER_PROFILE_PRIVATE` → 403). This endpoint
      // verifies that the cross-module throwing path still routes
      // correctly without the achievement filter.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/profile-private')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Profile of user user-target-1 is not public');
      expect(body.extensions?.code).toBe('USER_PROFILE_PRIVATE');
    });
  });

  describe('Discussion-module exceptions (Phase 3.1 — first Phase-3 conversion; name-based lookup → ProblemCodeMapping)', () => {
    // 12 concrete exceptions → 4 status codes (400/403/404/409). The
    // 13th class (UserNotFoundError) is owned by the user module,
    // not by the discussion module — its mapping entry was declared
    // in Phase 1 and is reused.
    //
    // Phase 3.1 wire-shape changes (verified per-row below):
    //   1. `title` is now the standard RFC 7807 title (e.g.
    //      `'NotFound'`) instead of the class name (e.g.
    //      `'ThreadNotFoundError'`).
    //   2. `extensions.timestamp` is now present (Phase 3.1
    //      deliverable per §8.4.1).
    //
    // Plan §8.4.1 risk notes (regression-guarded):
    //   - CommentThreadMismatchError → 400 (one might expect 409
    //     Conflict for a cross-resource mismatch).
    //   - ModeratorRequiredError → 403 (the class name suggests
    //     auth required, but the semantic is "you're authenticated
    //     but lack the moderator role").

    it('ThreadNotFoundError → 404 DISCUSSION_THREAD_NOT_FOUND (title now standardized)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/thread-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      // Phase 3.1 wire-shape: `title` is now `'NotFound'`, not the
      // class name `'ThreadNotFoundError'`.
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Thread not found: thread-1');
      expect(body.extensions?.code).toBe('DISCUSSION_THREAD_NOT_FOUND');
      // Phase 3.1 deliverable per §8.4.1.
      expect(typeof body.extensions?.timestamp).toBe('string');
    });

    it('CommentNotFoundError → 404 DISCUSSION_COMMENT_NOT_FOUND (title now standardized)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/comment-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Comment not found: comment-1');
      expect(body.extensions?.code).toBe('DISCUSSION_COMMENT_NOT_FOUND');
      expect(typeof body.extensions?.timestamp).toBe('string');
    });

    it('ThreadForbiddenError → 403 DISCUSSION_THREAD_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/thread-forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to perform this action on this thread');
      expect(body.extensions?.code).toBe('DISCUSSION_THREAD_FORBIDDEN');
    });

    it('CommentForbiddenError → 403 DISCUSSION_COMMENT_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/comment-forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to perform this action on this comment');
      expect(body.extensions?.code).toBe('DISCUSSION_COMMENT_FORBIDDEN');
    });

    it('ThreadClosedError → 409 DISCUSSION_THREAD_CLOSED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/thread-closed')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('This thread is closed and cannot accept new comments');
      expect(body.extensions?.code).toBe('DISCUSSION_THREAD_CLOSED');
    });

    it('ThreadNotActiveError → 409 DISCUSSION_THREAD_NOT_ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/thread-not-active')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('This thread is not active and cannot be modified');
      expect(body.extensions?.code).toBe('DISCUSSION_THREAD_NOT_ACTIVE');
    });

    it('CommentThreadMismatchError → 400 DISCUSSION_COMMENT_THREAD_MISMATCH (non-obvious 400 per §8.4.1)', async () => {
      // Plan §8.4.1 risk note: this is a non-obvious 400 (one might
      // expect 409 Conflict for a cross-resource mismatch). The
      // migration test captures it.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/comment-thread-mismatch')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe('The selected comment does not belong to this thread');
      expect(body.extensions?.code).toBe('DISCUSSION_COMMENT_THREAD_MISMATCH');
    });

    it('SelfVoteError → 403 DISCUSSION_SELF_VOTE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/self-vote')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You cannot vote on your own content');
      expect(body.extensions?.code).toBe('DISCUSSION_SELF_VOTE');
    });

    it('SelfReportError → 403 DISCUSSION_SELF_REPORT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/self-report')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You cannot report your own content');
      expect(body.extensions?.code).toBe('DISCUSSION_SELF_REPORT');
    });

    it('DuplicateReportError → 409 DISCUSSION_DUPLICATE_REPORT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/duplicate-report')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('You have already reported this content');
      expect(body.extensions?.code).toBe('DISCUSSION_DUPLICATE_REPORT');
    });

    it('QuizNotFoundError → 404 DISCUSSION_QUIZ_NOT_FOUND (collision with QUIZ_NOT_FOUND documented at §9)', async () => {
      // This is the discussion-module version of `QuizNotFoundError`.
      // It uses `DISCUSSION_QUIZ_NOT_FOUND` (not `QUIZ_NOT_FOUND`).
      // The class-name collision with the quiz-module version is
      // documented at §9 item 1. Clients should switch on
      // `extensions.code`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/quiz-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Quiz not found: quiz-1');
      expect(body.extensions?.code).toBe('DISCUSSION_QUIZ_NOT_FOUND');
    });

    it('ModeratorRequiredError → 403 DISCUSSION_MODERATOR_REQUIRED (non-obvious 403 per §8.4.1)', async () => {
      // Plan §8.4.1 risk note: this is a non-obvious 403 (the class
      // name suggests auth required, but the semantic is "you're
      // authenticated but lack the moderator role"). The migration
      // test captures it.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/moderator-required')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Moderator or admin role is required to perform this action');
      expect(body.extensions?.code).toBe('DISCUSSION_MODERATOR_REQUIRED');
    });

    it('every Phase 3.1 response carries `extensions.timestamp` (Phase 3.1 deliverable per §8.4.1)', async () => {
      // §8.4.1: "Add `extensions.requestId` and `extensions.timestamp`
      // to the response body." `extensions.requestId` was added in
      // Phase 1; `extensions.timestamp` is added in Phase 3.1 via the
      // global filter. This test exercises one discussion response
      // and verifies the timestamp field is present.
      //
      // Note: in this e2e fixture there is no `CorrelationInterceptor`,
      // so `request.id` is `undefined` and JSON serialization drops the
      // `extensions.requestId` key from the wire. That's a JSON-level
      // quirk (not a filter bug). Phase 3.1 only commits to adding
      // `extensions.timestamp`, so we do not assert `requestId` here.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/discussion/thread-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(typeof body.extensions?.timestamp).toBe('string');
      // Verify the timestamp is ISO 8601 (regex sanity-check; the
      // filter uses `new Date().toISOString()` so this is always
      // true unless the filter implementation drifts).
      expect(body.extensions?.timestamp as string).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Ranking-module exceptions (Phase 3.2 — eighth and final legacy → RFC 7807 conversion)', () => {
    // 3 concrete exceptions → 2 status codes (422 + 500). Highest-risk
    // Phase-3 conversion because the prior per-module filter was a
    // `@Catch()` catch-all that shadowed `GlobalExceptionFilter`.
    //
    // Phase 3.2 wire-shape changes (verified per-row below):
    //   1. The catch-all envelope `{ statusCode, message, code,
    //      timestamp }` is gone. Every error response is canonical
    //      RFC 7807 `ProblemDetailDto`.
    //   2. `extensions.code` is now set for the 3 ranking domain
    //      exceptions (was `'INTERNAL_ERROR'` for all under the prior
    //      filter).
    //   3. `RANKING_INVALID_XP_EVENT` is upgraded from 500 (catch-all)
    //      to 422 (semantic correction — rejected XP event input).
    //   4. The thrown message is preserved for all 3 domain exceptions
    //      (was discarded under the prior filter).
    //
    // Plan §8.4.2 completion criterion: "an artificial `throw new
    // Error('boom')` inside a ranking controller produces a 500 with
    // the standard shape" — verified by the uncaught-error test below.

    it('InvalidXpEventError → 422 RANKING_INVALID_XP_EVENT (semantic upgrade from 500)', async () => {
      // Wire-shape improvements:
      //   1. Status upgrade 500 → 422 (rejected input, not internal
      //      server failure).
      //   2. `extensions.code` is now `'RANKING_INVALID_XP_EVENT'`
      //      (was `'INTERNAL_ERROR'` under the prior filter).
      //   3. Thrown message preserved (was `'Internal server error'`).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/invalid-xp-event')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.detail).toBe('Invalid XP event: Amount must be positive');
      expect(body.extensions?.code).toBe('RANKING_INVALID_XP_EVENT');
    });

    it('RankCalculationError → 500 RANKING_RANK_CALCULATION_ERROR (message preserved)', async () => {
      // Wire-shape improvements:
      //   1. `extensions.code` is now `'RANKING_RANK_CALCULATION_ERROR'`
      //      (was `'INTERNAL_ERROR'` under the prior filter).
      //   2. Thrown message preserved (was `'Internal server error'`).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/rank-calculation-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Rank calculation failed for daily: db deadlock');
      expect(body.extensions?.code).toBe('RANKING_RANK_CALCULATION_ERROR');
    });

    it('PeriodResetError → 500 RANKING_PERIOD_RESET_ERROR (message preserved)', async () => {
      // Wire-shape improvements:
      //   1. `extensions.code` is now `'RANKING_PERIOD_RESET_ERROR'`
      //      (was `'INTERNAL_ERROR'` under the prior filter).
      //   2. Thrown message preserved (was `'Internal server error'`).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/period-reset-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Period reset failed for weekly: scheduler offline');
      expect(body.extensions?.code).toBe('RANKING_PERIOD_RESET_ERROR');
    });

    it("uncaught `Error('boom')` inside a ranking controller → 500 standard RFC 7807 shape (Plan §8.4.2 completion criterion)", async () => {
      // Plan §8.4.2 completion criterion: "For ranking: an artificial
      // `throw new Error('boom')` inside a ranking controller produces
      // a 500 with the standard shape, **and** the existing
      // `requestLogger.error({ event: 'unhandled_exception', ... })`
      // log line still appears."
      //
      // Before Phase 3.2 this error was caught by
      // `RankingDomainExceptionFilter`'s `@Catch()` and emitted as the
      // legacy `{ statusCode, message, code, timestamp }` envelope
      // with `code: 'INTERNAL_ERROR'`. After Phase 3.2 the catch-all
      // is removed; the global filter handles it as canonical RFC 7807
      // and logs `event: 'unhandled_exception'`.
      //
      // Note: the test environment sets `NODE_ENV=production` for the
      // app (per `app.useGlobalPipes` / `app.enableShutdownHooks` /
      // similar setup in the e2e bootstrap), so the global filter
      // returns `detail: 'Internal server error'` (not the raw
      // exception message) — this is the standard production-mode
      // sanitization. The thrown message is still logged via
      // `event: 'unhandled_exception'`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/uncaught-error')
        .expect(500);
      const body = res.body as ProblemWire;
      // RFC 7807 standard shape (NOT the legacy ranking envelope).
      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      expect(body.title).toBe('InternalServerError');
      expect(body.status).toBe(500);
      expect(typeof body.instance).toBe('string');
      expect(typeof body.extensions?.timestamp).toBe('string');
      // Phase 4 (§6.3 + §8.5): every 5xx carries `extensions.code =
      // 'GLOBAL_INTERNAL_ERROR'`. This is the uniform value across
      // uncaught Errors, 5xx `HttpException` instances, and any
      // 5xx status that falls through the table. Previously (Phase
      // 3.2 only) this field was `undefined` for the uncaught-Error
      // path; Phase 4 makes it uniform with the rest of the wire
      // shape.
      expect(body.extensions?.code).toBe('GLOBAL_INTERNAL_ERROR');
    });
  });

  describe('Notification-module exceptions (Phase 5 rev5.1 — missed-module cleanup)', () => {
    // Phase 5 (rev5.1) coverage: notification was inadvertently
    // skipped in Phases 1-3 because it had no per-module filter.
    // Its errors extended `Error` directly, so the global filter
    // caught them via its `instanceof Error` branch and returned
    // 500 with `title: 'InternalServerError'` — masking a legitimate
    // 404 (notification not found) as a generic 500 and masking a
    // legitimate 403 (user lacks permission for this specific
    // notification) the same way. Phase 5 (rev5.1) converts them to
    // `BaseDomainException` subclasses; the global filter now
    // resolves the correct status + `extensions.code` for both.
    // 2 concrete exceptions → 2 status codes (404 + 403).

    it('NotificationNotFoundError → 404 NOTIFICATION_NOT_FOUND (status correction 500 → 404)', async () => {
      // Wire-shape improvement: pre-Phase-5 this was a 500
      // catch-all (the global filter's `instanceof Error` branch
      // routes plain `Error` subclasses to 500 regardless of intent).
      // After Phase 5 (rev5.1) the global filter resolves the new
      // code `NOTIFICATION_NOT_FOUND` → 404 via `ProblemCodeMapping`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/notification/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/notification-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Notification not found: notif-1');
      expect(body.extensions?.code).toBe('NOTIFICATION_NOT_FOUND');
    });

    it('NotificationForbiddenError → 403 NOTIFICATION_FORBIDDEN (status correction 500 → 403)', async () => {
      // Wire-shape improvement: pre-Phase-5 this was a 500
      // catch-all. After Phase 5 (rev5.1) the global filter resolves
      // the new code `NOTIFICATION_FORBIDDEN` → 403 via
      // `ProblemCodeMapping`. Note on 401 vs 403: the throw-site is
      // post-authentication (the caller IS logged in; the check is
      // `notification.userId !== user.sub`), so 403 is correct (you
      // are who you say you are, you just don't own this
      // notification).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/notification/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to access this notification');
      expect(body.extensions?.code).toBe('NOTIFICATION_FORBIDDEN');
    });
  });

  describe('native HttpException (Phase 4 — synthesized `extensions.code`)', () => {
    // Plan §6.3 + §8.5: the global filter now synthesizes
    // `extensions.code` for non-domain `HttpException` paths so
    // clients can switch on `code` uniformly. The table lives in
    // the global filter itself (no separate registry). Status 400
    // from `ValidationPipe` (string[] of errors) emits the special
    // `GLOBAL_VALIDATION_FAILED`; all other 400s default to
    // `GLOBAL_BAD_REQUEST`.

    it('NotFoundException → 404 GLOBAL_NOT_FOUND (plan §8.5 completion criterion)', async () => {
      // Phase 4: a 404 from a missing route now carries
      // `extensions.code = 'GLOBAL_NOT_FOUND'`. Pre-Phase-4 the field
      // was `undefined`; clients had to switch on `status` alone.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/http-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Not Found');
      expect(body.extensions?.code).toBe('GLOBAL_NOT_FOUND');
    });

    it('BadRequestException with `string[]` message (ValidationPipe shape) → 400 GLOBAL_VALIDATION_FAILED', async () => {
      // Phase 4 (§6.3 override): a 400 carrying a `string[]` message
      // (the shape NestJS `ValidationPipe` produces for failed
      // class-validator checks) emits `GLOBAL_VALIDATION_FAILED`
      // instead of the default `GLOBAL_BAD_REQUEST`. Clients
      // rendering per-field UI use this code to skip the
      // `detail: '...; ...; ...'` joined-string render and instead
      // inspect `extensions.validationErrors` (Phase 5+; not yet
      // implemented).
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/http-bad-request-validation')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Bad Request');
      // ValidationPipe joins field errors with `; ` per the global
      // filter's existing logic — Phase 4 does not change `detail`
      // formatting, only the `code` synthesis.
      expect(body.detail).toBe('title must be a string; title must not be empty');
      expect(body.extensions?.code).toBe('GLOBAL_VALIDATION_FAILED');
    });
  });
});
