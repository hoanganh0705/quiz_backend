import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http'; // type of the request and response objects
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino'; // type of the configuration object for nestjs-pino
// cannot resolve the package export map entry, causing a TS2307 in Docker builds.
// The types are correct at runtime; we just suppress the resolution error here.
import type { SerializedError, SerializedRequest, SerializedResponse } from 'pino-std-serializers';

/**
 * Pino redaction paths — defense in depth against accidental
 * credential leakage into log files.
 *
 * The `req` serializer (below) already whitelists a few safe headers,
 * but the lifecycle "request completed" log emitted by `nestjs-pino`
 * includes the **full raw request** inside the `responseTime` payload,
 * with `cookies` and `rawHeaders`. Those two alone carry every JWT
 * we ever issue. The `redact` paths below guarantee that even if
 * a future caller serializes `req`/`res`/`responseTime` unsafely,
 * the redacted fields show up as `[REDACTED]` in the log stream.
 *
 * Coverage:
 *   - `req.headers.authorization`     → Bearer <access_token>
 *   - `req.headers.cookie`            → `auth_token=...; refreshToken=...`
 *   - `req.headers["set-cookie"]`     → response set-cookie (refresh tokens)
 *   - `req.rawHeaders`                → the raw, non-lowercased copy
 *   - `req.cookies.*`                 → fastify/express parsed cookies
 *   - `req.body.*token*`              → any request body field whose
 *                                      name contains "token" (login
 *                                      DTOs, refresh DTOs, etc.)
 *   - `res.req.*`                     → the request mirror that
 *                                      `nestjs-pino` attaches to
 *                                      the response object's log
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.rawHeaders',
  'req.cookies.*',
  'req.cookies.auth_token',
  'req.cookies.refreshToken',
  'req.cookies.refresh_token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'res.req.headers.authorization',
  'res.req.headers.cookie',
  'res.req.rawHeaders',
  'res.req.cookies.*',
  // `responseTime` is set by nestjs-pino on the lifecycle "request
  // completed" event and includes the full `req` mirror — scrub it too.
  'responseTime.req.headers.authorization',
  'responseTime.req.headers.cookie',
  'responseTime.req.rawHeaders',
  'responseTime.req.cookies.*',
] as const;

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
      // Defense-in-depth redaction (see REDACT_PATHS comment above).
      redact: {
        paths: [...REDACT_PATHS],
        censor: '[REDACTED]',
        remove: false,
      },
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
      // `pino-http` emits TWO lifecycle log events per request:
      //   - "request completed" (success)
      //   - "request failed" (error)
      //
      // The THIRD argument pino-http passes to `customSuccessObject` /
      // `customErrorObject` is the **default lifecycle payload** — an
      // OBJECT of shape `{ res, responseTime }` (NOT a bare number).
      // A previous version of this file treated that argument as a
      // numeric `responseTime`, which caused the entire object
      // (including the full Express `res` + `req` mirror with
      // cookies, rawHeaders, and the request body) to be logged
      // under the `responseTime` key on every request. The shape
      // below destructures ONLY the scalar `responseTime` number
      // and discards the default `res` payload — the explicit `res`
      // serializer (above) is the only place that emits response
      // metadata.
      customSuccessObject: (
        req: IncomingMessage,
        res: ServerResponse,
        defaultPayload: { responseTime: number },
      ) => ({
        event: 'http.request.completed',
        responseTime: defaultPayload.responseTime,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        // Explicitly DO NOT spread `req`, `res.req`, or the default
        // payload's `res` here — all three carry cookies /
        // rawHeaders / bodies. The serializer above is the only
        // safe path for logging request metadata.
      }),
      customErrorObject: (
        req: IncomingMessage,
        res: ServerResponse,
        _error: Error,
        defaultPayload: { responseTime: number },
      ) => ({
        event: 'http.request.failed',
        responseTime: defaultPayload.responseTime,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      }),
      level: isTest ? 'warn' : isProduction ? 'info' : 'debug',
    },
  };
};
