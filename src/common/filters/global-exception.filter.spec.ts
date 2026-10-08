import { GlobalExceptionFilter } from './global-exception.filter';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PinoLogger } from 'nestjs-pino';
import { UserNotFoundError } from '@/modules/user/domain/errors/user-domain.errors';

const MESSAGE_LENGTH_CAP = 1024;

const makeHost = (): {
  host: ArgumentsHost;
  responseBody: { payload: unknown };
} => {
  const responseBody = { payload: undefined as unknown };
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn((payload: unknown) => {
      responseBody.payload = payload;
      return response;
    }),
    setHeader: jest.fn(),
  } as unknown as Response;
  const request = {
    id: 'req-1',
    method: 'GET',
    url: '/users/by-username/test',
    originalUrl: '/users/by-username/test',
    headers: {},
  } as unknown as Request;
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, responseBody };
};

const buildFilter = (nodeEnv: 'production' | 'development' | 'test') => {
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  } as unknown as PinoLogger;
  const serverConfig = {
    port: 3000,
    nodeEnv,
    corsOrigins: [],
    trustProxy: false,
  };
  return new GlobalExceptionFilter(logger, serverConfig);
};

describe('GlobalExceptionFilter — message length cap', () => {
  it('caps details.message at 1024 chars in production logs (input > cap)', () => {
    const { host } = makeHost();
    const filter = buildFilter('production');
    const longMessage = 'x'.repeat(MESSAGE_LENGTH_CAP * 3);

    filter.catch(new UserNotFoundError(longMessage), host);

    const warnCall = (filter['logger'] as unknown as { warn: jest.Mock }).warn.mock.calls[0];
    expect(warnCall).toBeDefined();
    const logged = warnCall[0] as { details: string };
    expect(logged.details.length).toBeLessThanOrEqual(MESSAGE_LENGTH_CAP);
    expect(logged.details).toContain('[truncated]');
  });

  it('does not modify details.message when shorter than the cap', () => {
    const { host } = makeHost();
    const filter = buildFilter('production');
    const shortMessage = 'a short error';

    filter.catch(new UserNotFoundError(shortMessage), host);

    const warnCall = (filter['logger'] as unknown as { warn: jest.Mock }).warn.mock.calls[0];
    const logged = warnCall[0] as { details: string };
    expect(logged.details).toBe(shortMessage);
  });

  it('does NOT cap details.message in development', () => {
    const { host } = makeHost();
    const filter = buildFilter('development');
    const longMessage = 'y'.repeat(MESSAGE_LENGTH_CAP * 2);

    filter.catch(new UserNotFoundError(longMessage), host);

    const warnCall = (filter['logger'] as unknown as { warn: jest.Mock }).warn.mock.calls[0];
    const logged = warnCall[0] as { details: string };
    expect(logged.details.length).toBe(longMessage.length);
  });

  it('caps HttpException messages logged at warn in production', () => {
    const { host } = makeHost();
    const filter = buildFilter('production');
    const longMessage = 'z'.repeat(MESSAGE_LENGTH_CAP * 2);

    const exception = new HttpException(
      { message: longMessage, error: 'Bad' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    const warnCall = (filter['logger'] as unknown as { warn: jest.Mock }).warn.mock.calls[0];
    const logged = warnCall[0] as { details: string };
    expect(logged.details.length).toBeLessThanOrEqual(MESSAGE_LENGTH_CAP);
  });

  it('does NOT mutate the response detail (HTTP response stays intact)', () => {
    const { host, responseBody } = makeHost();
    const filter = buildFilter('production');
    const longMessage = 'q'.repeat(MESSAGE_LENGTH_CAP * 2);

    filter.catch(new UserNotFoundError(longMessage), host);

    const problem = responseBody.payload as { detail: string };
    expect(problem.detail.length).toBe(longMessage.length);
  });
});
