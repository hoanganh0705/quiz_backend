import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * Shared transactional context backed by AsyncLocalStorage.
 *
 * ## How it works
 *
 * When a controller handler is decorated with `@Transactional()`, the
 * `TransactionalInterceptor` wraps the entire handler in `context.run()`.
 *
 * Inside the handler chain (service → repository → Drizzle), any code that calls
 * `db.transaction()` can check `context.getDbClient()` first:
 *   - If a client is stored (another layer already opened the transaction), reuse it.
 *   - Otherwise, open a new transaction normally.
 *
 * This means nested `db.transaction()` calls are collapsed into a single DB
 * transaction without any caller having to explicitly pass a `tx` parameter.
 *
 * ## Usage in repositories
 *
 * ```typescript
 * async myAtomicOperation(params) {
 *   const existingTx = this.transactionalContext.getDbClient() as typeof this.db;
 *   if (existingTx) {
 *     return existingTx.execute(myQuery);
 *   }
 *   return this.db.transaction(async (tx) => { ... });
 * }
 * ```
 */
@Injectable()
export class TransactionalContext {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

  private static readonly DB_CLIENT_KEY = 'db_transaction_client';

  /**
   * Run `callback` inside a transactional scope.
   * The store is available to all downstream calls (repositories, services, etc.)
   * in the same async chain.
   */
  run<T>(callback: () => T): T {
    return this.storage.run(new Map<string, unknown>(), callback);
  }

  /**
   * Returns the currently active transaction client, if one is already open
   * (e.g., because a parent `db.transaction()` was already started by an
   * outer layer). Repositories can call this to avoid opening duplicate
   * transactions when already inside a transactional scope.
   *
   * Cast the return value to the appropriate Drizzle DB type at the call site.
   */
  getDbClient(): unknown {
    return this.storage.getStore()?.get(TransactionalContext.DB_CLIENT_KEY) ?? null;
  }

  /**
   * Stores the active transaction client in the context. Callers that open a
   * transaction should call this so nested layers can reuse the same transaction.
   */
  setDbClient(tx: unknown): void {
    this.storage.getStore()?.set(TransactionalContext.DB_CLIENT_KEY, tx);
  }
}

export const TRANSACTIONAL_CONTEXT = Symbol('TRANSACTIONAL_CONTEXT');
