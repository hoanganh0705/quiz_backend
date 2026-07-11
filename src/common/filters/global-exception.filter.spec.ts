import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import type { ServerConfig } from '@/core/config';

interface ProblemWire {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
}

class FakeAuthError extends BaseDomainException {
  readonly code = 'AUTH_INVALID_CREDENTIALS';
  constructor() {
    super('Invalid email or password');
  }
}

class FakeNotFoundError extends BaseDomainException {
  readonly code = 'AUTH_SESSION_NOT_FOUND';
  constructor() {
    super('Session not found');
  }
}

class FakeConflictError extends BaseDomainException {
  readonly code = 'AUTH_DELETION_FAILED';
  constructor() {
    super('Account deletion failed');
  }
}

class FakeRateLimitedError extends BaseDomainException {
  readonly code = 'AUTH_RATE_LIMITED';
  constructor() {
    super('Too many requests');
  }
}

interface FakeResponse {
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
}

interface FakeRequest {
  method: string;
  url: string;
  originalUrl: string;
  id: string;
}

interface CapturedResponse {
  status: number;
  body: unknown;
}

/**
 * Build a `GlobalExceptionFilter` with stubbed deps plus a fake `ArgumentsHost`
 * that captures `response.status(code)` and `response.json(body)` calls so each
 * test can assert on the wire shape directly.
 */
function buildFixture(nodeEnv: 'development' | 'production' = 'development') {
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;

  const serverConfig: ServerConfig = {
    port: 0,
    nodeEnv,
    corsOrigins: [],
    trustProxy: false,
  };

  const filter = new GlobalExceptionFilter(logger, serverConfig);

  const captured: CapturedResponse = {
    status: 0,
    body: undefined,
  };

  // Capture via closure (captured), not via `this`. Annotating with
  // `this: void` would also work but fails the `noImplicitThis` rule check,
  // so we use the named-interface pattern instead.
  const response: FakeResponse = {
    status(code: number): FakeResponse {
      captured.status = code;
      return response;
    },
    json(body: unknown): FakeResponse {
      captured.body = body;
      return response;
    },
  };

  const request: FakeRequest = {
    method: 'GET',
    url: '/fixture',
    originalUrl: '/fixture',
    id: 'req-fixture-123',
  };

  const host = {
    switchToHttp() {
      return {
        getResponse: (): FakeResponse => response,
        getRequest: (): FakeRequest => request,
      };
    },
  } as unknown as ArgumentsHost;

  return { filter, host, captured, request, logger };
}

describe('GlobalExceptionFilter', () => {
  describe('BaseDomainException (mapping-lookup path)', () => {
    it('renders a 401 with `extensions.code` for AUTH_INVALID_CREDENTIALS', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(new FakeAuthError(), host);

      expect(captured.status).toBe(HttpStatus.UNAUTHORIZED);
      const body = captured.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/auth-invalid-credentials');
      expect(body.title).toBe('Unauthorized');
      expect(body.status).toBe(401);
      expect(body.detail).toBe('Invalid email or password');
      expect(body.instance).toBe('/fixture');
      expect(body.extensions).toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
        requestId: 'req-fixture-123',
      });
    });

    it('renders a 404 with the session-specific typeUri', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(new FakeNotFoundError(), host);

      expect(captured.status).toBe(404);
      const body = captured.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/auth-session-not-found');
      expect(body.title).toBe('NotFound');
      expect(body.extensions?.code).toBe('AUTH_SESSION_NOT_FOUND');
    });

    it('renders a 409 for a conflict code', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(new FakeConflictError(), host);

      expect(captured.status).toBe(HttpStatus.CONFLICT);
      const body = captured.body as ProblemWire;
      expect(body.title).toBe('Conflict');
      expect(body.extensions?.code).toBe('AUTH_DELETION_FAILED');
    });

    it('renders a 429 for a rate-limited code', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(new FakeRateLimitedError(), host);

      expect(captured.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = captured.body as ProblemWire;
      expect(body.title).toBe('TooManyRequests');
      expect(body.extensions?.code).toBe('AUTH_RATE_LIMITED');
    });

    it('emits `http_client_error` at warn for 4xx domain errors', () => {
      const { filter, host, logger } = buildFixture();

      filter.catch(new FakeAuthError(), host);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn stub; treat as Mock
      const warn = logger.warn as unknown as jest.Mock;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn stub; treat as Mock
      const error = logger.error as unknown as jest.Mock;

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'http_client_error',
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          error: 'Unauthorized',
        }),
      );
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe('native HttpException (status-based path)', () => {
    it('renders 404 with `error` from the response body as title (NotFoundException)', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(new NotFoundException('Plain route does not exist.'), host);

      expect(captured.status).toBe(HttpStatus.NOT_FOUND);
      const body = captured.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/not-found');
      expect(body.title).toBe('Not Found');
      expect(body.detail).toBe('Plain route does not exist.');
      // Phase 4 (§6.3 + §8.5): `extensions.code` is now synthesized
      // for native `HttpException` paths. Status 404 →
      // `GLOBAL_NOT_FOUND`. Plan §8.5 completion criterion: "A 404
      // from a missing route includes `extensions.code =
      // 'GLOBAL_NOT_FOUND'`."
      expect(body.extensions?.code).toBe('GLOBAL_NOT_FOUND');
      expect(body.extensions?.requestId).toBe('req-fixture-123');
    });

    it('renders 400 with a string-array message joined as `detail` (ValidationPipe shape)', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(
        new BadRequestException(['title must be a string', 'title must not be empty']),
        host,
      );

      expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
      const body = captured.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/bad-request');
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('title must be a string; title must not be empty');
      // Phase 4 (§6.3 override): `BadRequestException` with a
      // `string[]` message (the `ValidationPipe` shape) synthesizes
      // `GLOBAL_VALIDATION_FAILED` instead of the default
      // `GLOBAL_BAD_REQUEST`. Clients rendering per-field UI use
      // this code to skip the joined-string render and instead
      // inspect `extensions.validationErrors` (Phase 5+; not yet
      // implemented).
      expect(body.extensions?.code).toBe('GLOBAL_VALIDATION_FAILED');
    });

    it('renders 400 with a string message → GLOBAL_BAD_REQUEST (default for non-validation)', () => {
      // Phase 4 (§6.3): non-validation 400s default to
      // `GLOBAL_BAD_REQUEST`. This is the path for manually-thrown
      // `BadRequestException('Invalid from date')` from
      // application-layer query validation (e.g. ranking's
      // `get-user-ranking-history.query.ts:83,87,91`).
      const { filter, host, captured } = buildFixture();

      filter.catch(new BadRequestException('Invalid from date'), host);

      expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
      const body = captured.body as ProblemWire;
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('Invalid from date');
      expect(body.extensions?.code).toBe('GLOBAL_BAD_REQUEST');
    });

    it('renders 401 with GLOBAL_UNAUTHENTICATED (plan §8.5 completion criterion)', () => {
      // Phase 4 (§8.5): "A 401 from `JwtGuard` now includes
      // `extensions.code = 'GLOBAL_UNAUTHENTICATED'`." Exercised
      // here by throwing `UnauthorizedException` directly (which is
      // what `JwtGuard` throws in production).
      const { filter, host, captured } = buildFixture();

      filter.catch(new UnauthorizedException('Authorization header is missing'), host);

      expect(captured.status).toBe(HttpStatus.UNAUTHORIZED);
      const body = captured.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/unauthorized');
      expect(body.extensions?.code).toBe('GLOBAL_UNAUTHENTICATED');
    });

    it('renders 403 with GLOBAL_FORBIDDEN', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch(new ForbiddenException('Caller lacks required permission'), host);

      expect(captured.status).toBe(HttpStatus.FORBIDDEN);
      const body = captured.body as ProblemWire;
      expect(body.extensions?.code).toBe('GLOBAL_FORBIDDEN');
    });

    it('renders 429 with GLOBAL_RATE_LIMITED (@nestjs/throttler shape)', () => {
      // Phase 4 (§6.3): 429 → `GLOBAL_RATE_LIMITED`. This is the path
      // for `@nestjs/throttler` rejecting an over-limit request.
      const { filter, host, captured } = buildFixture();

      filter.catch(new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS), host);

      expect(captured.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = captured.body as ProblemWire;
      expect(body.extensions?.code).toBe('GLOBAL_RATE_LIMITED');
    });

    it('renders 5xx with GLOBAL_INTERNAL_ERROR (e.g. InternalServerErrorException)', () => {
      // Phase 4 (§6.3): "5xx → GLOBAL_INTERNAL_ERROR." This covers
      // unmodeled 5xx paths like `ServiceUnavailableException` (503)
      // or `BadGatewayException` (502).
      const { filter, host, captured } = buildFixture();

      filter.catch(new HttpException('Upstream offline', HttpStatus.SERVICE_UNAVAILABLE), host);

      expect(captured.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const body = captured.body as ProblemWire;
      expect(body.extensions?.code).toBe('GLOBAL_INTERNAL_ERROR');
    });

    it('emits `http_client_error` at warn with the synthesized `code` (Phase 4 logging update)', () => {
      const { filter, host, logger } = buildFixture();

      filter.catch(new NotFoundException('Plain route does not exist.'), host);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn stub; treat as Mock
      const warn = logger.warn as unknown as jest.Mock;
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'http_client_error',
          statusCode: 404,
          // Phase 4: the synthesized `code` is included in the log
          // line so on-call can grep for `GLOBAL_*` codes uniformly.
          code: 'GLOBAL_NOT_FOUND',
          error: 'Not Found',
        }),
      );
    });
  });

  describe('plain Error (uncaught path)', () => {
    it('renders 500 in development mode with the developer message', () => {
      const { filter, host, captured } = buildFixture('development');

      filter.catch(new Error('boom'), host);

      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = captured.body as ProblemWire;
      expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
      expect(body.title).toBe('InternalServerError');
      expect(body.detail).toBe('boom');
      // Phase 4 (§6.3): every 5xx response carries `extensions.code
      // = 'GLOBAL_INTERNAL_ERROR'`. Plain `Error` instances are
      // mapped to 500 → GLOBAL_INTERNAL_ERROR.
      expect(body.extensions?.code).toBe('GLOBAL_INTERNAL_ERROR');
    });

    it('renders 500 in production mode with a sanitized message', () => {
      const { filter, host, captured } = buildFixture('production');

      filter.catch(new Error('database connection refused: 10.0.0.1'), host);

      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = captured.body as ProblemWire;
      expect(body.detail).toBe('Internal server error');
    });

    it('emits `unhandled_exception` at error level for plain Errors', () => {
      const { filter, host, logger } = buildFixture();

      filter.catch(new Error('boom'), host);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn stub; treat as Mock
      const error = logger.error as unknown as jest.Mock;
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'unhandled_exception',
          errorName: 'Error',
          errorMessage: 'boom',
        }),
      );
    });
  });

  describe('non-Error throwable', () => {
    it('renders 500 without crashing the filter', () => {
      const { filter, host, captured } = buildFixture();

      filter.catch('a non-error throwable', host);

      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = captured.body as ProblemWire;
      expect(body.title).toBe('InternalServerError');
      expect(body.extensions?.code).toBeUndefined();
    });
  });
});
