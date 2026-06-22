import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

export const createPinoHttpConfig = (configService: ConfigService): Params => {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
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
          return url.startsWith('/health') || url.startsWith('/ready') || url.startsWith('/metrics');
        },
      },
      serializers: {
        req: (req) => ({
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
        res: (res) => ({
          statusCode: res.statusCode,
          headers: {
            'x-request-id': res.getHeader('x-request-id'),
            'x-correlation-id': res.getHeader('x-correlation-id'),
          },
        }),
        err: (err) => ({
          name: err.name,
          message: err.message,
          stack: isProduction ? undefined : err.stack,
          cause: isProduction ? undefined : err.cause,
        }),
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessObject: (req, res, responseTime) => ({
        event: 'http_request_completed',
        responseTime,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      }),
      customErrorObject: (req, res, error, responseTime) => ({
        event: 'http_request_failed',
        responseTime,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        errName: error?.name ?? 'UnknownError',
      }),
      level: isTest ? 'warn' : isProduction ? 'info' : 'debug',
    },
  };
};
