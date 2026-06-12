/**
 * Correlation ID utilities
 *
 * Provides a module-level AsyncLocalStorage singleton for correlation IDs.
 * The `CorrelationInterceptor` writes the ID; any downstream code (services,
 * repositories) reads it via `getCorrelationId()` without needing DI.
 *
 * Structured logging policy:
 * - Every log entry in a request-scoped context MUST include `correlationId`
 *   (use `createCorrelationId()` — falls back to UUID for background jobs)
 * - Event adapters should call `createCorrelationId()` once at the top of each
 *   handler and thread it through all log statements in that handler
 * - In HTTP controllers, correlation IDs are automatically assigned by
 *   `CorrelationInterceptor`; services/repos access them via `getCorrelationId()`
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

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

/**
 * Get the correlation ID, falling back to a fresh UUID when outside a request context.
 * Use this in event adapters and background jobs where no HTTP request exists.
 */
export function createCorrelationId(): string {
  return getCorrelationId() ?? randomUUID();
}
