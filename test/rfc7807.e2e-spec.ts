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

  @Get('http-not-found')
  httpNotFound(): never {
    throw new NotFoundException('Plain route does not exist.');
  }

  @Get('http-bad-request-validation')
  httpBadRequestValidation(): never {
    // Shape produced by NestJS ValidationPipe (string[] of error messages).
    throw new BadRequestException(['title must be a string', 'title must not be empty']);
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
});
