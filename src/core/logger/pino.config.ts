import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http'; // type of the request and response objects
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino'; // type of the configuration object for nestjs-pino
import type { SerializedError, SerializedRequest, SerializedResponse } from 'pino-std-serializers'; // type of the serialized request, response, and error objects. For example, req will be serialized to only include the id, method, url, and headers. res will be serialized to only include the statusCode and headers. err will be serialized to only include the type, message, stack, and cause.

export const createPinoHttpConfig = (configService: ConfigService): Params => {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development'); // default to development if NODE_ENV is not set
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  return {
    pinoHttp: {
      genReqId: (req, res) => {
        const existingId = req.headers['x-request-id'];
        const requestId =
          typeof existingId === 'string' && existingId.length > 0
            ? existingId
            : Array.isArray(existingId)
              ? String(existingId[0])
              : randomUUID();

        res.setHeader('x-request-id', requestId);
        return requestId;
      },
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'SYS:standard',
              },
            },
          }),
      autoLogging: {
        ignore: (req) => {
          const url = req.url ?? '';
          return (
            url.startsWith('/health') || url.startsWith('/ready') || url.startsWith('/metrics')
          );
        },
      },
      serializers: {
        req: (req: SerializedRequest) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          headers: {
            'x-request-id': req.headers['x-request-id'],
            'x-correlation-id': req.headers['x-correlation-id'],
            origin: req.headers.origin,
            'user-agent': req.headers['user-agent'],
          },
        }),
        res: (res: SerializedResponse) => ({
          statusCode: res.statusCode,
          headers: {
            'x-request-id': res.raw.getHeader('x-request-id'),
            'x-correlation-id': res.raw.getHeader('x-correlation-id'),
          },
        }),
        err: (err: SerializedError) => ({
          type: err.type,
          message: err.message,
          stack: isProduction ? undefined : err.raw.stack,
          cause: isProduction ? undefined : err.raw.cause,
        }),
      },
      customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessObject: (req: IncomingMessage, res: ServerResponse, responseTime: number) => ({
        event: 'http_request_completed',
        responseTime,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      }),
      customErrorObject: (
        req: IncomingMessage,
        res: ServerResponse,
        error: Error,
        responseTime: number,
      ) => ({
        event: 'http_request_failed',
        responseTime,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      }),
      level: isTest ? 'warn' : isProduction ? 'info' : 'debug',
    },
  };
};
