# ADR-0006: Request Lifecycle — Global Interceptor Chain

## Status

Accepted

## Context

Every HTTP request passes through a chain of cross-cutting concerns: correlation ID propagation, database transaction management, and response envelope formatting. These concerns must be applied uniformly without polluting controller code. The system needs a predictable, auditable order of operations for every request.

## Decision

**Interceptor chain (in order):**

1. **CorrelationInterceptor** (`src/common/interceptors/correlation.interceptor.ts`) — runs first. Reads `x-correlation-id` from the request header; if absent, generates a UUIDv4 via `crypto.randomUUID()`. Stores the ID in `AsyncLocalStorage` and sets it as the `X-Correlation-ID` response header.

2. **TransactionalInterceptor** (`src/common/interceptors/transactional.interceptor.ts`) — runs second. Wraps the request in a database transaction if and only if the controller handler is decorated with `@Transactional()`. Uncommitted transactions are always rolled back. Commits only on explicit `await tx.commit()`.

3. **ResponseFormatInterceptor** (`src/common/interceptors/response-format.interceptor.ts`) — runs last. Wraps the response in `{ data, meta }`, injects `meta.timestamp`, and normalizes all temporal fields to ISO 8601 UTC via `normalizeTemporalFields()`.

**Global guards run before all interceptors:** `ThrottlerGuard` (rate limiting), `JwtGuard` (authentication), and `PermissionsGuard` (authorization) execute before the interceptor chain begins. A request that fails a guard never reaches any interceptor.

**Guards run before interceptors — exception filter always runs:** Even if all interceptors and controllers succeed, `GlobalExceptionFilter` is always registered as the last line of defense for any uncaught exception.

**AsyncLocalStorage:** `TransactionalContext` (`src/common/interceptors/transactional-context.ts`) uses `AsyncLocalStorage` to hold the active transaction across the call stack. Controllers and repositories access it via `TransactionalContext.get()` without needing to pass it explicitly.

## Consequences

**Advantages**
- Correlation ID is available from the very first line of the interceptor chain to every downstream service, repository, and event handler.
- The `@Transactional()` decorator on handlers makes transaction boundaries explicit — no implicit ambient transactions.
- The interceptor order is fixed: correlation → transaction → response format. Changing the order would require deliberate refactoring, not accidental insertion.
- `AsyncLocalStorage` means repositories do not need the transaction object passed as a parameter, keeping method signatures clean.

**Trade-offs**
- The three-interceptor chain means three layers of wrapping; debugging the chain requires understanding each layer.
- `AsyncLocalStorage` can be surprising in async contexts (e.g. callbacks, `setTimeout`, `Promise.all` over unrelated tasks). The codebase avoids these patterns; any new code using callbacks must explicitly handle the context.
- TransactionalInterceptor's "uncommitted → rollback" behavior means a controller that forgets `@Transactional()` runs outside a transaction, which is sometimes correct (read-only queries) and sometimes a bug.

## Evidence

- `src/common/interceptors/correlation.interceptor.ts` — `CorrelationInterceptor` with `AsyncLocalStorage<string>`.
- `src/common/interceptors/transactional.interceptor.ts` — `@Injectable() export class TransactionalInterceptor`.
- `src/common/interceptors/transactional-context.ts` — `TransactionalContext` singleton with `AsyncLocalStorage<Client>`.
- `src/common/interceptors/response-format.interceptor.ts` — `ResponseFormatInterceptor` with `normalizeTemporalFields()`.
- `src/app.module.ts` — all three interceptors registered globally via `APP_INTERCEPTOR`.
- `docs/architecture/request-flow.md` — full lifecycle diagram and step-by-step description.
- `docs/PROJECT_CONSTITUTION.md` §4.6 (Security and authorization) covers the guard chain; §3.4 covers interceptor registrations in module configuration.
