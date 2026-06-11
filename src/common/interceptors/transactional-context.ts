import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * Shared transactional context backed by AsyncLocalStorage.
 *
 * ## How it works
 *
 * When a controller handler is decorated with `@Transactional()` or enters the
 * `CorrelationInterceptor`, the `TransactionalContext` stores values in AsyncLocalStorage.
 * All downstream code (services, repositories) can retrieve them via `get()`.
 *
 * ## Usage
 *
 * ```typescript
 * // Store a value (interceptor)
 * context.set('my_key', myValue);
 *
 * // Retrieve it (service/repository)
 * const value = context.get<MyType>('my_key');
 * ```
 */
@Injectable()
export class TransactionalContext {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

  private static readonly DB_CLIENT_KEY = 'db_transaction_client';

  /**
   * Run `callback` inside a scoped execution.
   * The store is available to all downstream calls in the same async chain.
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

  /**
   * Store a value under a key in the current async scope.
   */
  set<T>(key: string, value: T): void {
    this.storage.getStore()?.set(key, value);
  }

  /**
   * Retrieve a value by key from the current async scope.
   */
  get<T>(key: string): T | undefined {
    return this.storage.getStore()?.get(key) as T | undefined;
  }

  /**
   * Check whether a key exists in the current async scope.
   */
  has(key: string): boolean {
    return this.storage.getStore()?.has(key) ?? false;
  }

  /**
   * Delete a key from the current async scope.
   */
  delete(key: string): void {
    this.storage.getStore()?.delete(key);
  }
}

export const TRANSACTIONAL_CONTEXT = Symbol('TRANSACTIONAL_CONTEXT');
