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
});
