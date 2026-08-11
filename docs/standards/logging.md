# Logging Standard

> Pino is the single, canonical logging mechanism across the backend. This document defines the logging architecture, log levels, event naming convention, standard fields, HTTP / error / authentication / scheduler / queue semantics, redaction, request-ID propagation, and the developer checklist for adding a new log.

## Purpose

Establish one consistent logging strategy so:

1. A new developer can follow the standard without inventing another logging style.
2. Operators can search, filter, and alert on structured event names with predictable fields.
3. Credentials, tokens, and PII never reach a log file, even when a developer accidentally logs an entire request.

## Scope

Applies to all backend application code under `src/`. CLI tools (`src/commands/`, `scripts/`) and tests may use `console.*` for human-readable CLI output — see §14 for the policy.

## Source of Truth

- `src/core/logger/logger.module.ts` — Nest module wiring.
- `src/core/logger/pino.config.ts` — redaction paths, serializers, level policy, HTTP access-log shape, request-ID propagation, correlation-ID integration.
- `src/common/filters/global-exception.filter.ts` — single owner of HTTP error logging.
- `src/common/interceptors/correlation.interceptor.ts` — assigns `correlationId` into the AsyncLocalStorage so background jobs / queue handlers / schedulers can join logs to the originating request.

## 1. Architecture

```text
Application (NestJS)
   |
   +-- Controllers / Services / Schedulers / Queue Workers
   |     |
   |     +--> @InjectPinoLogger(ClassName)
   |     |       |
   |     |       +--> nestjs-pino PinoLogger (child of root)
   |     |
   |     +--> throws BaseDomainException / HttpException
   |                |
   |                v
   |     GlobalExceptionFilter (single owner of error logs)
   |
   +-- HTTP layer
   |     |
   |     +--> pino-http access log (single owner of HTTP request logs)
   |
   v
Pino (single root instance)
   |
   +----------------------+
   |                      |
Development           Production
pino-pretty           structured JSON
```

There is **exactly one** Pino root instance. There is **no** `AppLoggerService`, `LoggingService`, `LoggerAdapter`, or any other wrapper class. NestJS services inject `PinoLogger` from `nestjs-pino` and call the standard methods.

The NestJS default `Logger` from `@nestjs/common` is **prohibited** in application code. The Socket.IO `RedisIoAdapter` is the only place that resolves `PinoLogger` programmatically (the IoAdapter lifecycle sits outside DI).

## 2. Pino Configuration

Defined in `src/core/logger/pino.config.ts`:

| Setting | Value |
| --- | --- |
| Library | `nestjs-pino` + `pino-http` |
| Transport (dev) | `pino-pretty` with `colorize`, `singleLine`, `translateTime: 'SYS:standard'` |
| Transport (prod) | raw JSON to `stdout` |
| Default level (dev) | `debug` |
| Default level (prod) | `info` |
| Default level (test) | `warn` (suppresses noisy expected-failure traffic) |
| Auto-logging ignore paths | `/health`, `/ready`, `/metrics` |
| Redaction | Pino-native `redact` with explicit paths, censor `[REDACTED]` |
| Request ID | generated if `x-request-id` absent, otherwise reused; echoed via `x-request-id` response header |
| Correlation ID | separate header (`x-correlation-id`), assigned by `CorrelationInterceptor` into `correlationIdStorage` AsyncLocalStorage |
| HTTP success event | `http.request.completed` |
| HTTP failure event | `http.request.failed` |
| Error serializer | type / message / stack (dev) / cause (dev) only |

## 3. Log Levels

| Level | When | Examples |
| --- | --- | --- |
| `trace` | Reserved. Off by default. | — |
| `debug` | Developer diagnostics. Off in prod. | Cache hit, decision path, internal state |
| `info` | Normal lifecycle event worth a permanent record. | `auth.login.success`, `quiz.published`, `scheduler.job.completed`, `http.request.completed` |
| `warn` | Unexpected but recoverable. | Retry scheduled, rate-limit hit, expected lock contention, known degraded dependency |
| `error` | Actual failure requiring investigation. | Unhandled exception, DB failure, queue job DLQ, `http.request.failed`, `http_server_error` |
| `fatal` | Process is unusable. Reserved. | — |

`ERROR` MUST NOT be used for **expected** business outcomes: invalid credentials, validation failure, resource-not-found, business rule violation. Those are `WARN` or `INFO` depending on whether the operator cares.

## 4. Event Naming Convention

Event names live in the structured `event` field of every log entry.

Format:

```text
<domain>.<action>[.<result>]
```

- Lowercase.
- Dot-separated (NOT snake_case, NOT camelCase).
- Predictable — `auth.login.success` is easier to grep than `user_login_succeeded`.
- The `.result` segment is REQUIRED when there is a meaningful success/failure axis (`auth.login.success`, `auth.login.failed`); otherwise the event name is the action alone (`auth.logout`, `quiz.published`).

### Canonical event families

```text
http.request.completed
http.request.failed

auth.login.success
auth.login.failed
auth.logout
auth.logout.all
auth.token.refresh.success
auth.token.refresh.failed
auth.password.reset.requested
auth.password.reset.completed
auth.rate_limit.exceeded

quiz.created
quiz.updated
quiz.deleted
quiz.published

scheduler.job.started
scheduler.job.completed
scheduler.job.failed
scheduler.job.skipped

queue.job.started
queue.job.completed
queue.job.failed
queue.job.retrying

email.send.success
email.send.error
email.send.skipped_duplicate

outbox.event.processed
outbox.event.retry_scheduled
outbox.event.exhausted_retries
outbox.dlq.alert
```

Pre-existing event names that already follow `snake_case` and are referenced from dashboards / alerts (e.g. `tournament_scheduler_skipped_lock_held`, `auth_login_failed`) are kept as-is for compatibility. New code MUST use the `domain.action.result` style.

## 5. Standard Fields

A typical structured log entry:

```json
{
  "level": 30,
  "time": 1786170120000,
  "pid": 9185,
  "hostname": "quiz-api-pod-3",
  "service": "quiz-backend",
  "environment": "production",
  "requestId": "ca0662e7-29f0-457c-94d9-effc2c443a01",
  "correlationId": "d2c3b1e3-b7ee-422f-b146-aec3d8066347",
  "context": "AuthLoginService",
  "event": "auth.login.failed",
  "userId": "019fa348-6ad0-719b-a10b-b2ce0d6bfa62",
  "reason": "invalid_credentials"
}
```

Only the fields meaningful for that event MUST be present. In particular:

| Field | When |
| --- | --- |
| `event` | Always |
| `context` | Always (auto-added by `nestjs-pino` from the constructor argument) |
| `userId` | When known |
| `requestId` | When in an HTTP request scope (added by `pino-http`) |
| `correlationId` | When in a request scope or a queue/scheduler scope that restored one |
| `ipAddress` | For security events only (`auth.*`, `account.*`, security notifications) |
| `durationMs` | For timed operations (jobs, scheduler tasks, lock acquisitions) |
| `attempt` / `attemptsMade` / `maxAttempts` | For retries |
| `reason` | Categorical reason for a failure event (NOT a free-form message) |

Free-form `message` strings MAY appear as the second positional Pino argument for backwards compatibility, but **searchability is provided by the `event` field, not the message**. New code MUST rely on `event`.

## 6. HTTP Logging

Pino's HTTP middleware (`pino-http` via `nestjs-pino`) emits **two** lifecycle events:

| Event | Level | When |
| --- | --- | --- |
| `http.request.completed` | `info` (2xx/3xx), `warn` (4xx), `error` (5xx) | A request finished, regardless of HTTP status |
| `http.request.failed` | `error` | An exception was thrown and not caught by the global filter |

Standard payload:

```json
{
  "event": "http.request.completed",
  "requestId": "...",
  "method": "POST",
  "url": "/api/v1/auth/login",
  "statusCode": 201,
  "responseTime": 163
}
```

HTTP access logs MUST NOT serialize:

- the full `req` (with `cookies`, `rawHeaders`, `body`)
- the full `res` (with `_header` containing the full `Set-Cookie` value, which carries the refresh token)
- the entire Express/Fastify internal `_readableState`, `_writableState`, `_events`, etc.

The Pino `req`/`res` serializers in `pino.config.ts` emit ONLY: HTTP method, URL, request ID, correlation ID, origin, user-agent, and response status code.

`/health`, `/ready`, `/metrics` are excluded from auto-logging entirely.

## 7. Error Logging

The `GlobalExceptionFilter` is the **single owner** of error logging for HTTP requests. Services MUST NOT also `logger.error(...)` for the same exception. The pattern is:

- Throw the exception (`BaseDomainException` subclass, `HttpException`, or domain error).
- The global filter logs once at the appropriate level (`warn` for 4xx, `error` for 5xx) with `event: 'http_client_error' | 'http_server_error' | 'unhandled_exception' | 'unhandled_non_error_exception' | 'unknown_error_code'`.
- Re-throw is unnecessary; Nest sends the response.

Services that perform non-HTTP operations (background jobs, queue workers, schedulers) log their own errors directly — there is no filter to own those.

## 8. Authentication / Security Logging

Use one of the canonical auth events:

| Event | When |
| --- | --- |
| `auth.login.success` | Login flow returned tokens |
| `auth.login.failed` | Any login failure (invalid credentials, unverified email, etc.) |
| `auth.token.refresh.success` / `auth.token.refresh.failed` | Refresh flow |
| `auth.logout` / `auth.logout.all` | Logout (single / all sessions) |
| `auth.password.reset.requested` / `auth.password.reset.completed` | Password reset flow |
| `auth.rate_limit.exceeded` | Auth rate limit hit |

Safe metadata allowed:

```text
userId
requestId
correlationId
ipAddress
authenticationMethod
deviceType
reason          // categorical: invalid_credentials | account_disabled | rate_limited | token_reuse
```

NEVER log:

- `password` (plaintext or hashed)
- `passwordHash`
- `accessToken`, `refreshToken`, `accessTokenJti`, `refreshTokenJti`
- `authorization` header
- cookie contents
- session secrets
- API keys, client secrets
- OTPs, verification codes, reset tokens

Failed-login reasons are categorical (e.g. `invalid_credentials`), NOT raw request payloads. The submitted email is PII and is NOT logged on the "unknown email" password-reset path — see `auth-password-reset-unknown-email` event.

## 9. Redaction

Pino's native `redact` paths (`pino.config.ts`) cover the realistic Express/Fastify request shapes:

```text
req.headers.authorization
req.headers.cookie
req.headers["set-cookie"]
req.rawHeaders
req.cookies.*
req.cookies.auth_token
req.cookies.refreshToken
req.cookies.refresh_token
req.body.accessToken
req.body.refreshToken
req.body.password
req.body.currentPassword
req.body.newPassword
req.body.token

res.req.headers.authorization
res.req.headers.cookie
res.req.rawHeaders
res.req.cookies.*

responseTime.req.headers.authorization
responseTime.req.headers.cookie
responseTime.req.rawHeaders
responseTime.req.cookies.*
```

`censor` is `[REDACTED]`. Adding new redaction paths is preferred over relying on developers to remember which fields are sensitive.

The previous `customSuccessObject` / `customErrorObject` implementation passed the **default pino-http lifecycle payload** (an object of shape `{ res, responseTime }`) as if it were a scalar number. The bug caused every request to log the full request mirror with `body.password` and `res._header` (containing the Set-Cookie refresh token) under the `responseTime` key. The current implementation destructures ONLY `defaultPayload.responseTime` (the scalar) and ignores the rest. This is the single most important rule in this document — see the inline comment in `pino.config.ts`.

## 10. Request ID / Correlation ID

There are two related identifiers:

| Header | Generated by | Persisted by |
| --- | --- | --- |
| `x-request-id` | `pino-http`'s `genReqId` (reuse-or-generate) | Echoed on the response; copied into `req.id` so every Pino log inside the request carries it |
| `x-correlation-id` | `CorrelationInterceptor` | Stored in `correlationIdStorage` (AsyncLocalStorage) so services, repos, schedulers, and queue workers can read it without explicit threading |

`genReqId` in `pino.config.ts` is the single source of truth. If the client provides `x-request-id`, it is reused (validated as a non-empty string); otherwise a UUID is generated.

The `CorrelationInterceptor` runs as a global `APP_INTERCEPTOR` and assigns `correlationId` to both the Pino child logger (`pino.assign(...)`) AND the AsyncLocalStorage. Background jobs and BullMQ workers restore the correlation ID before invoking their handler — see `EmailProcessor` and the auth outbox processor for the pattern.

Do NOT generate a new correlation ID inside a service or repository.

## 11. Scheduler Logging

Each `@Cron` job follows a 3-line shape:

```ts
this.logger.info({ event: 'scheduler.job.started', job: 'trending-refresh' });
try {
  const summary = await this.work();
  this.logger.info({ event: 'scheduler.job.completed', job: 'trending-refresh', ...summary });
} catch (error) {
  this.logger.error({
    event: 'scheduler.job.failed',
    job: 'trending-refresh',
    message: error instanceof Error ? error.message : String(error),
  });
}
```

Distributed-lock contention is **expected** when multiple replicas run — log it at `info` (NOT `error`) with `event: 'scheduler.job.skipped'` and `reason: 'lock_held'`.

```ts
this.logger.info({
  event: 'scheduler.job.skipped',
  job: 'handleCloseDueRounds',
  reason: 'lock_held',
});
```

The pre-existing `cron_trending_refresh_*` / `tournament_scheduler_*` event families are kept for compatibility with existing dashboards; new cron jobs SHOULD use the `scheduler.job.*` family.

## 12. Queue / Worker Logging

BullMQ workers log at the boundary between the dispatcher and the handler:

| Event | Level | When |
| --- | --- | --- |
| `queue.job.started` | `info` | Worker picked up the job |
| `queue.job.completed` | `info` | Handler returned without throwing |
| `queue.job.failed` | `error` | Handler threw and the job entered retry/DLQ |
| `queue.job.retrying` | `warn` | Handler threw but retries remain |

Required fields:

```text
queue
job
jobId
attempt
durationMs
```

Do NOT dump the full job payload — it may contain tokens, OTPs, or PII. If a payload field is needed for debugging, log it under a known-safe alias (e.g. `userId`, `eventType`) and rely on Pino redaction for the rest.

## 13. Domain / Application / Infrastructure Boundaries

Domain code MUST NOT import Pino directly. The dependency direction is:

```text
Domain       -> business logic only
Application  -> orchestration / use cases
Infrastructure -> Pino, Redis, DB, queue workers
Transport    -> HTTP access logging
```

In practice this means:

- Domain services receive a `PinoLogger` if they need to emit a domain event (`badge.awarded`, `quiz.published`). This is acceptable because the logger is injected, not statically imported, and the domain layer still has no hard dependency on the logging library.
- Domain value objects and pure functions MUST NOT log.
- Infrastructure code (repositories, adapters, schedulers, queue workers) MAY use Pino directly because observability IS its concern.

## 14. `console.*` Policy

After this refactor, `console.*` calls are **prohibited** in normal backend application code under `src/modules/**`, `src/common/**`, and `src/core/**`.

Allowed exceptions:

| Location | Reason |
| --- | --- |
| `src/commands/seed/*`, `src/commands/outbox.ts` | CLI tooling with human-readable output. Pino `pino-pretty` output is too noisy for operator terminals and breaks `pnpm db:seed:* \| grep` patterns. |
| `scripts/backfill/*.ts`, `scripts/smoke-*.ts` | Same — CLI scripts. |
| Test bootstrap (`test/*.e2e-spec.ts`) — `console.warn(...)` only | Gate output for skipping suites that lack `DATABASE_URL`. These run via Jest and are not deployed. |

Adding a new `console.*` call outside the allowed locations is a `blocker` in code review. Migrate to Pino:

```ts
this.logger.warn({ event: '...' });
```

## 15. Examples

### Auth login success

```ts
this.logger.info({
  event: 'auth.login.success',
  userId: identity.userId,
  authenticationMethod: 'password',
});
```

### Auth login failed

```ts
this.logger.warn({
  event: 'auth.login.failed',
  reason: 'invalid_credentials', // categorical, NOT the submitted email or password
});
```

### Scheduler skipped due to lock contention

```ts
this.logger.info({
  event: 'scheduler.job.skipped',
  job: 'handleCloseDueRounds',
  reason: 'lock_held',
});
```

### Outbox DLQ alert

```ts
this.logger.error({
  event: 'outbox.dlq.alert',
  totalDlqEvents: rows.length,
  sampleEventIds: rows.slice(0, 5).map((e) => e.eventId),
});
```

### Queue job failure

```ts
this.logger.error({
  event: 'queue.job.failed',
  queue: 'email',
  job: 'send_verification_email',
  jobId: job.id,
  attempt: job.attemptsMade,
  maxAttempts: job.opts.attempts,
  message: error.message,
});
```

## 16. Developer Checklist — "I'm adding a new feature. How should I log?"

1. Inject `@InjectPinoLogger(MyService.name) private readonly logger: PinoLogger` in the constructor.
2. Decide whether this is a lifecycle event (`info`), a recoverable anomaly (`warn`), or a real failure (`error`).
3. Pick the canonical event name (`auth.login.success`, `scheduler.job.started`, `outbox.event.retry_scheduled`, …). If none fits, follow `<domain>.<action>[.<result>]` and add it to §4.
4. Include only the meaningful structured fields. Do NOT include the full request, full response, or arbitrary application state.
5. Never log credentials, tokens, password hashes, authorization headers, cookies, OTPs, or session secrets. If a payload field MIGHT contain such a value, add a redaction path to `pino.config.ts`.
6. Do NOT also log errors that the global exception filter will already log. Throw and let the filter own the entry.

## 17. Anti-Patterns

| Anti-pattern | Why |
| --- | --- |
| `console.log(...)` | Bypasses Pino. No structured fields, no redaction, no level filtering. |
| `new Logger(MyService.name)` | NestJS default `Logger` writes to `console.*` with its own format. Disjoint from Pino. |
| `this.logger.log(...)` | `nestjs-pino`'s `PinoLogger` does not expose `log()`. Use `info`/`warn`/`error`/`debug`/`trace`/`fatal`. |
| `this.logger.info({ req })` | Serializes the entire Express `req` — leaks `body`, `cookies`, `rawHeaders`. Use the request ID instead. |
| `this.logger.info({ body: req.body })` | Same leak. Log specific fields by name. |
| `this.logger.info(\`User ${userId} did X with email ${email}\`)` | Unstructured, PII, not searchable. Use structured fields. |
| Duplicating the global exception filter's error log inside the controller | 4× the noise for one failure. Throw and let the filter own it. |
| Free-form reason strings (`reason: error.message`) | Strings are unsearchable. Use categorical reasons from §8. |
