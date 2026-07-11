import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import type { ServerConfig } from '@/core/config';

interface ProblemWire {
  type: string;
  title: string;
  status: number;
  detail?: string;
  extensions?: Record<string, unknown>;
}

/**
 * Concrete `BaseDomainException` whose `code` is intentionally NOT in
 * `ProblemCodeMapping`. Used to exercise the loud-failure branch.
 *
 * The class lives inside the spec file because it must never be imported
 * from production code — if you ever see `UnknownFixtureError` in a
 * module, this test is being misused.
 */
class UnknownFixtureError extends BaseDomainException {
  readonly code = 'AUTH_THIS_CODE_HAS_NO_MAPPING';
  constructor() {
    super('This exception deliberately tests the unknown-code branch.');
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

function buildFixture() {
  // Strongly-typed logger mocks. The declared parameter type disambiguates
  // the jest mock from `unknown[]` so consumers can assert on the record
  // shape; the parameter itself is unused because the filter doesn't
  // inspect calls — only consumers (the spec) do.
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
    nodeEnv: 'development',
    corsOrigins: [],
    trustProxy: false,
  };

  const filter = new GlobalExceptionFilter(logger, serverConfig);

  const captured: CapturedResponse = {
    status: 0,
    body: undefined,
  };

  // Explicit `this: void` annotations avoid `unbound-method` lint warnings
  // and prevent accidental `this` capture. The capture is via closure
  // (`captured`), not via `this`.
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
    method: 'POST',
    url: '/fixture/unknown',
    originalUrl: '/fixture/unknown',
    id: 'req-unknown-789',
  };

  const host = {
    switchToHttp() {
      return {
        getResponse: (): FakeResponse => response,
        getRequest: (): FakeRequest => request,
      };
    },
  } as unknown as ArgumentsHost;

  return { filter, host, captured, logger };
}

function lastLogForEvent(logger: PinoLogger, event: string): Record<string, unknown> | undefined {
  const matches = (logger.error as jest.Mock).mock.calls.filter((args: unknown[]): boolean => {
    const record = args[0] as Record<string, unknown> | undefined;
    return record?.event === event;
  });
  const last = matches[matches.length - 1] as unknown[] | undefined;
  return last?.[0] as Record<string, unknown> | undefined;
}

describe('Unknown-error-code loud-failure branch', () => {
  it('renders a 500 with the generic ProblemDetail', () => {
    const { filter, host, captured } = buildFixture();

    filter.catch(new UnknownFixtureError(), host);

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = captured.body as ProblemWire;
    expect(body.type).toBe('https://api.quiz.local/problems/internal-server-error');
    expect(body.title).toBe('InternalServerError');
    expect(body.detail).toBe('This exception deliberately tests the unknown-code branch.');
  });

  it('emits `extensions.code` with the unmapped code (so clients can see what went wrong)', () => {
    const { filter, host, captured } = buildFixture();

    filter.catch(new UnknownFixtureError(), host);

    const body = captured.body as ProblemWire;
    expect(body.extensions?.code).toBe('AUTH_THIS_CODE_HAS_NO_MAPPING');
    expect(body.extensions?.requestId).toBe('req-unknown-789');
  });

  it('logs an `unknown_error_code` event at error level', () => {
    const { filter, host, logger } = buildFixture();

    filter.catch(new UnknownFixtureError(), host);

    expect(lastLogForEvent(logger, 'unknown_error_code')).toEqual(
      expect.objectContaining({
        event: 'unknown_error_code',
        code: 'AUTH_THIS_CODE_HAS_NO_MAPPING',
        exceptionName: 'UnknownFixtureError',
        method: 'POST',
        url: '/fixture/unknown',
      }),
    );
  });

  it('does NOT log a duplicate http_server_error event (the unknown-code log is the signal)', () => {
    const { filter, host, logger } = buildFixture();

    filter.catch(new UnknownFixtureError(), host);

    // `logger.error` is called once for `unknown_error_code` only — the
    // regular `http_server_error` event is suppressed for this branch
    // because the unknown-code log already carries the relevant context.
    const errorCalls = (logger.error as jest.Mock).mock.calls;
    const unknownCodeLogs = errorCalls.filter((args: unknown[]) => {
      const record = args[0] as Record<string, unknown> | undefined;
      return record?.event === 'unknown_error_code';
    });
    const httpServerErrorLogs = errorCalls.filter((args: unknown[]) => {
      const record = args[0] as Record<string, unknown> | undefined;
      return record?.event === 'http_server_error';
    });
    expect(unknownCodeLogs).toHaveLength(1);
    expect(httpServerErrorLogs).toHaveLength(0);
  });
});
