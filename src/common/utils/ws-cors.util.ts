/**
 * WebSocket CORS origin resolution.
 *
 * Reading CORS_ORIGINS at module load time (rather than via `ConfigService`
 * DI) keeps gateways consistent with `@WebSocketGateway({ cors: { ... } })`
 * which is a decorator-level evaluation that runs before the Nest container
 * is fully wired.
 *
 * Behaviour:
 * - Splits `CORS_ORIGINS` on commas, trims, drops empties.
 * - If the resolved list is empty AND `NODE_ENV === 'production'`, throws
 *   at module construction so production cannot boot without an explicit
 *   allow-list (env.validation.ts already enforces the same on the HTTP
 *   side; this duplicates the gate for the WS layer).
 * - In development/test an empty list falls back to `*` so a developer
 *   who forgets to set the variable still gets a working local socket.
 */
export const resolveWsCorsOrigins = (): string | string[] => {
  const raw = process.env.CORS_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    if ((process.env.NODE_ENV ?? '').toLowerCase() === 'production') {
      throw new Error(
        'CORS_ORIGINS must be set in production so WebSocket gateways can apply a non-wildcard CORS policy. Add comma-separated allowed origins to the environment.',
      );
    }
    return '*';
  }

  return origins;
};
