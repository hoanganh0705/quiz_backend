# ADR-0009: Transaction Management — @Transactional Decorator + AsyncLocalStorage

## Status

Accepted

## Context

Database operations that span multiple repositories or involve both writes and event dispatches must be atomic — either all succeed or all fail. The system must manage PostgreSQL transactions without forcing every repository method to accept an optional transaction parameter, and without relying on NestJS's request-scoped providers which carry a performance cost.

## Decision

**Decorator:** `@Transactional()` from `src/common/interceptors/transactional.interceptor.ts` marks a controller handler as transactional.

**Interceptor behavior:** `TransactionalInterceptor` wraps the handler body in `db.transaction()`. The interceptor opens the transaction, stores it in `TransactionalContext` via `AsyncLocalStorage`, and guarantees a rollback on any uncaught exception. The handler explicitly calls `await tx.commit()` to persist.

**Transaction propagation:** Repository methods check `TransactionalContext.get()` first. If a transaction exists, they use it; otherwise they use the default connection pool. This means:
- A handler with `@Transactional()`: all repository calls use the shared transaction.
- A handler without `@Transactional()`: each repository call uses a separate auto-commit query.

**AsyncLocalStorage scope:** The transaction is stored in `AsyncLocalStorage` keyed to the current async execution context. This means:
- A transaction started in an interceptor is accessible to all downstream code (services, repositories) within the same request, without passing it as a parameter.
- When the async context ends (request completes), the storage slot is cleaned up.

**No NestJS request-scoped providers:** The codebase does not use `{ scope: Scope.REQUEST }` for transaction propagation. `AsyncLocalStorage` achieves the same effect without the per-request provider instantiation cost.

**Recovery:** If `TransactionalContext.get()` returns `undefined` but a transaction-aware operation is attempted, the code throws a `TransactionRequiredError`.

## Consequences

**Advantages**
- Zero boilerplate in repository methods — they call `this.db` and the context resolver handles the rest.
- The transaction boundary is explicit at the controller level, making it easy to audit which endpoints are transactional.
- No request-scoped providers means lower memory and GC pressure per request.
- The `commit()` call is in the handler, not the interceptor — application code controls when the transaction commits.

**Trade-offs**
- Handlers that forget `await tx.commit()` leave the transaction open until the connection is returned to the pool, holding a connection unnecessarily.
- Handlers that forget `@Transactional()` for a multi-step write operation silently fall back to auto-commit, risking partial writes.
- `AsyncLocalStorage` does not propagate across `Promise.all()` with unrelated tasks — the transaction context would leak into parallel branches. The codebase avoids this pattern.
- Nested `@Transactional()` calls on the same handler would create nested transactions (not supported by Postgres without savepoints), but this does not occur in the current codebase.

## Evidence

- `src/common/interceptors/transactional.interceptor.ts` — `@Transactional()` decorator and `TransactionalInterceptor`.
- `src/common/interceptors/transactional-context.ts` — `TransactionalContext` with `AsyncLocalStorage<Client>`.
- `src/modules/instance/transport/controller/instance.controller.ts` — `@Transactional()` on `joinTournament` and `submitAnswer`.
- `src/modules/notification/transport/controller/notification.controller.ts` — multiple `@Transactional()` on write handlers.
- `src/modules/auth/infrastructure/transaction/transactional.interceptor.ts` — auth-specific `TransactionalInterceptor` bound in `AuthModule`.
- `src/modules/category/infrastructure/repositories/category.repository.ts` — `softDelete` calls `TransactionalContext.withTransaction(tx, ...)` for cascade operations.
- `docs/PROJECT_CONSTITUTION.md` §5.5 — explicit `@Transactional()` boundary policy.
- `docs/architecture/persistence-flow.md` — `@Transactional()` + `AsyncLocalStorage` transaction management diagram.
