import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';

export const createPinoHttpConfig = (configService: ConfigService): Params['pinoHttp'] => {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  return {
    genReqId: (req, res) => {
      const existingId = req.headers['x-request-id'];
      const requestId =
        typeof existingId === 'string'
          ? existingId
          : Array.isArray(existingId)
            ? existingId[0]
            : randomUUID();

      res.setHeader('x-request-id', requestId);
      return requestId;
    },
    customProps: (req) => ({
      requestId: (req as { id?: string }).id,
    }),
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:standard',
          },
        },
    customSuccessObject: (req, res, responseTime) => ({
      event: 'http_request_completed',
      responseTime: Number(responseTime),
      method: req.method ?? 'UNKNOWN',
      url: req.url ?? '',
      statusCode: res.statusCode,
    }),
    customErrorObject: (req, res, error, responseTime) => ({
      event: 'http_request_failed',
      responseTime: Number(responseTime),
      method: req.method ?? 'UNKNOWN',
      url: req.url ?? '',
      statusCode: res.statusCode,
      errName: error.name,
    }),
  };
};
