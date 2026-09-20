/// <reference types="jest" />

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
  DuplicateReportError,
  ModeratorRequiredError,
  ParentCommentCrossThreadError,
  ParentCommentNotFoundError,
  QuizNotFoundError as CommentQuizNotFoundError,
  ReplyLimitExceededError,
  SelfReportError,
  SelfVoteError,
} from '@/modules/comment/domain/errors';
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

  @Get('user/analytics-not-found')
  userAnalyticsNotFound(): never {
    // Dead-code class — exported but never thrown in the codebase.
    throw new UserAnalyticsNotFoundError();
  }

  @Get('user/profile-private')
  userProfilePrivate(): never {
    throw new UserProfilePrivateError('user-abc');
  }

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

  @Get('review/not-found')
  reviewNotFound(): never {
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
    throw new BookmarkCollectionNotFoundError('Quiz not found');
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
    throw new UserProfilePrivateError('user-target-1');
  }

  @Get('comment/parent-comment-not-found')
  commentParentCommentNotFound(): never {
    throw new ParentCommentNotFoundError('parent-1');
  }

  @Get('comment/comment-not-found')
  commentCommentNotFound(): never {
    throw new CommentNotFoundError('comment-1');
  }

  @Get('comment/comment-forbidden')
  commentCommentForbidden(): never {
    throw new CommentForbiddenError();
  }

  @Get('comment/parent-comment-cross-thread')
  commentParentCommentCrossThread(): never {
    throw new ParentCommentCrossThreadError();
  }

  @Get('comment/reply-limit-exceeded')
  commentReplyLimitExceeded(): never {
    throw new ReplyLimitExceededError(100);
  }

  @Get('comment/self-vote')
  commentSelfVote(): never {
    throw new SelfVoteError();
  }

  @Get('comment/self-report')
  commentSelfReport(): never {
    throw new SelfReportError();
  }

  @Get('comment/duplicate-report')
  commentDuplicateReport(): never {
    throw new DuplicateReportError();
  }

  @Get('comment/quiz-not-found')
  commentQuizNotFound(): never {
    // This is the comment-module version of `QuizNotFoundError`.
    // It uses `COMMENT_QUIZ_NOT_FOUND` (not `QUIZ_NOT_FOUND`).
    // The class-name collision with the quiz-module version is
    // documented at §9 item 1.
    throw new CommentQuizNotFoundError('quiz-1');
  }

  @Get('comment/moderator-required')
  commentModeratorRequired(): never {
    throw new ModeratorRequiredError();
  }

  @Get('ranking/invalid-xp-event')
  rankingInvalidXpEvent(): never {
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

  @Get('notification/not-found')
  notificationNotFound(): never {
    throw new NotificationNotFoundError('notif-1');
  }

  @Get('notification/forbidden')
  notificationForbidden(): never {
    throw new NotificationForbiddenError();
  }

  @Get('plain-error')
  plainError(): never {
    throw new Error('boom');
  }

  @Get('non-error-throw')
  nonErrorThrow(): never {
    throw 'a non-error throwable';
  }

  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }
}

describe('RFC 7807 ProblemDetail', () => {
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
    it('renders the canonical ProblemDetail shape;', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/domain-not-found')
        .expect(500);

      const body = res.body as ProblemWire;

      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      expect(body.title).toBe('InternalServerError');
      expect(body.status).toBe(500);
      expect(body.detail).toBe("Fixture 'abc-123' was not found.");
      expect(body.instance).toBe('/rfc7807-fixture/domain-not-found');

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
      // default), but 5xx `detail` is always sanitized to `'Internal server error'`
      // regardless of environment — internal error details are logged server-side,
      // not surfaced to clients.
      expect(body.detail).toBe('Internal server error');
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

  describe('Auth-module exceptions (Live mapping through the global filter)', () => {
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

    it('ResourceConflictError → 409 AUTH_RESOURCE_CONFLICT', async () => {
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

  describe('Quiz-module exceptions (Live mapping through the global filter)', () => {
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

    it('QuizAnalyticsNotFoundError → 404 QUIZ_ANALYTICS_NOT_FOUND', async () => {
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

  describe('Attempt-module exceptions (Live mapping through the global filter)', () => {
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

    it('QuizNotPublishedError (attempt variant) → 422 ATTEMPT_QUIZ_NOT_PUBLISHED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/quiz-not-published')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.type).toBe('https://api.quiz.local/problems/attempt-quiz-not-published');
      expect(body.extensions?.code).toBe('ATTEMPT_QUIZ_NOT_PUBLISHED');
    });

    it('AttemptQuestionInvalidError → 422 ATTEMPT_QUESTION_INVALID', async () => {
      // Same wire-shape upgrade rationale as QuizNotPublishedError.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/attempt/question-invalid')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.extensions?.code).toBe('ATTEMPT_QUESTION_INVALID');
    });

    it('AttemptNotCompletedError → 422 ATTEMPT_NOT_COMPLETED', async () => {
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

  describe('User-module exceptions (Live mapping through the global filter)', () => {
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

    it('UserAnalyticsNotFoundError → 404 USER_ANALYTICS_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/analytics-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/user-analytics-not-found');
      expect(body.extensions?.code).toBe('USER_ANALYTICS_NOT_FOUND');
    });

    it('UserProfilePrivateError → 403 USER_PROFILE_PRIVATE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/user/profile-private')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.type).toBe('https://api.quiz.local/problems/user-profile-private');
      expect(body.extensions?.code).toBe('USER_PROFILE_PRIVATE');
      expect(body.detail).toBe('Profile of user user-abc is not public');
    });
  });

  describe('Category-module exceptions (Live mapping through the global filter)', () => {
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

    it('CategoryRestoreInvariantError → 500 CATEGORY_RESTORE_INVARIANT', async () => {
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

  describe('Tag-module exceptions (Live mapping through the global filter)', () => {
    // Structurally identical to the category describe-block above. The
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

    it('TagRestoreInvariantError → 500 TAG_RESTORE_INVARIANT', async () => {
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

  describe('Tournament-module exceptions (Live mapping through the global filter)', () => {
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

    it('TournamentForbiddenError → 403 TOURNAMENT_FORBIDDEN', async () => {
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

    it('TournamentAlreadyWithdrawnError → 409 TOURNAMENT_ALREADY_WITHDRAWN', async () => {
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

  describe('Review-module exceptions (Live mapping through the global filter)', () => {
    it('ReviewNotFoundError → 404 REVIEW_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Quiz not found');
      expect(body.extensions?.code).toBe('REVIEW_NOT_FOUND');
    });

    it('ReviewForbiddenError → 403 REVIEW_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/review/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to manage this review');
      expect(body.extensions?.code).toBe('REVIEW_FORBIDDEN');
    });

    it('ReviewConflictError → 409 REVIEW_CONFLICT', async () => {
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

  describe('Bookmark-module exceptions ', () => {
    it('BookmarkNotFoundError → 404 BOOKMARK_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/bookmark/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Bookmark not found');
      expect(body.extensions?.code).toBe('BOOKMARK_NOT_FOUND');
    });

    it('CollectionNotFoundError → 404 COLLECTION_NOT_FOUND', async () => {
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

  describe('Instance-module exceptions ', () => {
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

  describe('Social-module exceptions ', () => {
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

  describe('Achievement-module exceptions ', () => {
    it('BadgeNotFoundError → 404 BADGE_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/badge-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Badge not found: badge-abc');
      expect(body.extensions?.code).toBe('BADGE_NOT_FOUND');
    });

    it('AchievementUserNotFoundError → 404 ACHIEVEMENT_USER_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/user-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('User not found: user-1');
      expect(body.extensions?.code).toBe('ACHIEVEMENT_USER_NOT_FOUND');
    });

    it('UserBadgeOwnershipNotFoundError → 404 USER_BADGE_OWNERSHIP_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/user-badge-ownership-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Badge badge-abc not owned by user user-1');
      expect(body.extensions?.code).toBe('USER_BADGE_OWNERSHIP_NOT_FOUND');
    });

    it('AchievementGrantError → 500 ACHIEVEMENT_GRANT_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/grant-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Internal server error');
      expect(body.extensions?.code).toBe('ACHIEVEMENT_GRANT_ERROR');
    });

    it('UserProfilePrivateError (cross-module) → 403 USER_PROFILE_PRIVATE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/achievement/profile-private')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Profile of user user-target-1 is not public');
      expect(body.extensions?.code).toBe('USER_PROFILE_PRIVATE');
    });
  });

  describe('comment-module exceptions ', () => {
    it('ParentCommentNotFoundError → 404 COMMENT_PARENT_COMMENT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/parent-comment-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Parent comment not found: parent-1');
      expect(body.extensions?.code).toBe('COMMENT_PARENT_COMMENT_NOT_FOUND');
      expect(typeof body.extensions?.timestamp).toBe('string');
    });

    it('CommentNotFoundError → 404 COMMENT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/comment-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Comment not found: comment-1');
      expect(body.extensions?.code).toBe('COMMENT_NOT_FOUND');
      expect(typeof body.extensions?.timestamp).toBe('string');
    });

    it('ParentCommentCrossThreadError → 400 COMMENT_PARENT_COMMENT_CROSS_THREAD', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/parent-comment-cross-thread')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('BadRequest');
      expect(body.detail).toBe(
        'The selected parent comment is not a top-level comment on this quiz',
      );
      expect(body.extensions?.code).toBe('COMMENT_PARENT_COMMENT_CROSS_THREAD');
    });

    it('CommentForbiddenError → 403 COMMENT_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/comment-forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to perform this action on this comment');
      expect(body.extensions?.code).toBe('COMMENT_FORBIDDEN');
    });

    it('ReplyLimitExceededError → 409 COMMENT_REPLY_LIMIT_EXCEEDED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/reply-limit-exceeded')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('Maximum reply limit of 100 reached for this comment');
      expect(body.extensions?.code).toBe('COMMENT_REPLY_LIMIT_EXCEEDED');
    });

    it('ReportNotFoundError → 404 COMMENT_REPORT_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/report-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Report not found: report-1');
      expect(body.extensions?.code).toBe('COMMENT_REPORT_NOT_FOUND');
    });

    it('SelfVoteError → 403 COMMENT_SELF_VOTE', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/self-vote')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You cannot vote on your own content');
      expect(body.extensions?.code).toBe('COMMENT_SELF_VOTE');
    });

    it('SelfReportError → 403 COMMENT_SELF_REPORT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/self-report')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You cannot report your own content');
      expect(body.extensions?.code).toBe('COMMENT_SELF_REPORT');
    });

    it('DuplicateReportError → 409 COMMENT_DUPLICATE_REPORT', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/duplicate-report')
        .expect(409);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('You have already reported this content');
      expect(body.extensions?.code).toBe('COMMENT_DUPLICATE_REPORT');
    });

    it('QuizNotFoundError → 404 COMMENT_QUIZ_NOT_FOUND (collision with QUIZ_NOT_FOUND documented at §9)', async () => {
      // This is the comment-module version of `QuizNotFoundError`.
      // It uses `COMMENT_QUIZ_NOT_FOUND` (not `QUIZ_NOT_FOUND`).
      // The class-name collision with the quiz-module version is
      // documented at §9 item 1. Clients should switch on
      // `extensions.code`.
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/quiz-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Quiz not found: quiz-1');
      expect(body.extensions?.code).toBe('COMMENT_QUIZ_NOT_FOUND');
    });

    it('ModeratorRequiredError → 403 COMMENT_MODERATOR_REQUIRED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/moderator-required')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Moderator or admin role is required to perform this action');
      expect(body.extensions?.code).toBe('COMMENT_MODERATOR_REQUIRED');
    });

    it('every response carries `extensions.timestamp`', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/comment/comment-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(typeof body.extensions?.timestamp).toBe('string');
      expect(body.extensions?.timestamp as string).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Ranking-module exceptions ', () => {
    it('InvalidXpEventError → 422 RANKING_INVALID_XP_EVENT (semantic upgrade from 500)', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/invalid-xp-event')
        .expect(422);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('UnprocessableEntity');
      expect(body.detail).toBe('Invalid XP event: Amount must be positive');
      expect(body.extensions?.code).toBe('RANKING_INVALID_XP_EVENT');
    });

    it('RankCalculationError → 500 RANKING_RANK_CALCULATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/rank-calculation-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Internal server error');
      expect(body.extensions?.code).toBe('RANKING_RANK_CALCULATION_ERROR');
    });

    it('PeriodResetError → 500 RANKING_PERIOD_RESET_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/period-reset-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('Internal server error');
      expect(body.extensions?.code).toBe('RANKING_PERIOD_RESET_ERROR');
    });

    it("uncaught `Error('boom')` inside a ranking controller → 500 standard RFC 7807 shape", async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/ranking/uncaught-error')
        .expect(500);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      expect(body.title).toBe('InternalServerError');
      expect(body.status).toBe(500);
      expect(typeof body.instance).toBe('string');
      expect(typeof body.extensions?.timestamp).toBe('string');
      expect(body.extensions?.code).toBe('GLOBAL_INTERNAL_ERROR');
    });
  });

  describe('Notification-module exceptions ', () => {
    it('NotificationNotFoundError → 404 NOTIFICATION_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/notification/not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/notification-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.detail).toBe('Notification not found: notif-1');
      expect(body.extensions?.code).toBe('NOTIFICATION_NOT_FOUND');
    });

    it('NotificationForbiddenError → 403 NOTIFICATION_FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/notification/forbidden')
        .expect(403);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('You do not have permission to access this notification');
      expect(body.extensions?.code).toBe('NOTIFICATION_FORBIDDEN');
    });
  });

  describe('native HttpException ', () => {
    it('NotFoundException → 404 GLOBAL_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/http-not-found')
        .expect(404);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Not Found');
      expect(body.extensions?.code).toBe('GLOBAL_NOT_FOUND');
    });

    it('BadRequestException with `string[]` message (ValidationPipe shape) → 400 GLOBAL_VALIDATION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .get('/rfc7807-fixture/http-bad-request-validation')
        .expect(400);
      const body = res.body as ProblemWire;
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('title must be a string; title must not be empty');
      expect(body.extensions?.code).toBe('GLOBAL_VALIDATION_FAILED');
    });
  });
});
