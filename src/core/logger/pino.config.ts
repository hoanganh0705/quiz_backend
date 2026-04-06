import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';

export const pinoHttpConfig: Params['pinoHttp'] = {
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
    requestId: req.headers['x-request-id'],
  }),
  transport:
    process.env.NODE_ENV === 'production'
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
