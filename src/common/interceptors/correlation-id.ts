/**
 * Correlation ID utilities
 *
 * Provides a module-level AsyncLocalStorage singleton for correlation IDs.
 * The `CorrelationInterceptor` writes the ID; any downstream code (services,
 * repositories) reads it via `getCorrelationId()` without needing DI.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationIdStore {
  correlationId: string;
}

/** Module-level AsyncLocalStorage — lives for the duration of the process */
export const correlationIdStorage = new AsyncLocalStorage<CorrelationIdStore>();

/**
 * Get the correlation ID for the current async execution context.
 * Returns `undefined` when called outside an HTTP request (e.g., in background jobs).
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore()?.correlationId;
}
