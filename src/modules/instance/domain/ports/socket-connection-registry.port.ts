import type { JwtPayload } from '@/common/guards/jwt.guard';

/**
 * Port: `SocketConnectionRegistryPort`.
 *
 * Why this exists
 * ---------------
 * The Instance module needs to answer the question
 *   "Given a socket id that just disconnected on instance X,
 *    which `instanceId` and which `userId` did that socket belong to?"
 *
 * Pre-Phase-3 the answer was kept in a process-local
 * `Map<socketId, {instanceId,userId}>` that lived on
 * `InstanceApplicationService`. That works for single-instance
 * deployments but breaks the moment Socket.IO is horizontally
 * scaled: a socket that joins instance B and disconnects due to a
 * network blip will land on instance A, which has never seen that
 * socket id — the `Map.get` returns `undefined`, and
 * `PlayerDisconnectedEvent` is silently dropped.
 *
 * The Redis-backed `RedisSocketConnectionRegistry` puts the metadata
 * in Redis so any instance can answer the question. The TTL on the
 * entry matches the Socket.IO reconnection window: if the client
 * doesn't reconnect inside the window, the entry is purged and a
 * subsequent disconnect becomes a no-op (which is correct — we have
 * no other way to associate the disconnect with a player).
 *
 * Why a port and not direct ioredis
 * ---------------------------------
 * The instance module already depends on the `CacheProvider` port,
 * not on ioredis directly (other modules follow the same pattern).
 * Keeping this port in the domain layer keeps the application
 * service testable with a plain Jest mock of the port and avoids
 * threading an ioredis client through the gateway.
 */

export type SocketConnectionMeta = {
  /**
   * Instance the socket is bound to. A socket is uniquely
   * associated with one instance room at a time — the gateway
   * writes this when the client successfully joins via
   * `join_instance`.
   */
  instanceId: string;

  /**
   * User id of the authenticated client (`JwtPayload.sub`). The
   * registry asserts presence on write; `record` is a no-op if
   * the sub is missing.
   */
  userId: string;
};

export type SocketConnectionRegistryPort = {
  /**
   * Record or refresh the metadata for a socket. Idempotent:
   * calling `record(...)` twice for the same `socketId` simply
   * overwrites the entry and resets the TTL. Returns `true` if a
   * new entry was written, `false` if the entry already existed
   * and was overwritten.
   *
   * Callers:
   * - `InstanceGateway.handleJoinInstance` — after a successful
   *   `socket.join(instanceId)`.
   * - Anywhere a player is rebound to a fresh socket id (e.g.
   *   a reconnection flow added in a later phase).
   *
   * @returns `false` if the call was a no-op (the entry was
   * missing or the caller provided no user id); `true` otherwise.
   */
  record(socketId: string, meta: SocketConnectionMeta): Promise<boolean>;

  /**
   * Look up the metadata for a socket id. Returns `null` if the
   * entry has expired or never existed. Use this for
   * instrumentation; for the disconnect hot path prefer
   * `consume(...)` to read-and-delete atomically.
   */
  getMeta(socketId: string): Promise<SocketConnectionMeta | null>;

  /**
   * Read-and-delete the metadata for a socket id. Atomically
   * returns the value and removes the entry so two concurrent
   * disconnects (e.g. Socket.IO's `disconnect` event firing twice)
   * don't both emit `PlayerDisconnectedEvent` for the same
   * socket. Returns `null` if the entry has already been consumed
   * or never existed.
   */
  consume(socketId: string): Promise<SocketConnectionMeta | null>;

  /**
   * Heartbeat-utility used by tests to advance the TTL clock.
   * Production callers should never need this — the TTL is set
   * automatically on `record(...)`.
   */
  setTtlMs(ttlMs: number): void;

  /**
   * Read-only accessor exposing the TTL. Useful in tests and in
   * structured logs to confirm "did we record a metadata entry
   * with TTL X?".
   */
  getTtlMs(): number;
};

/**
 * Token used by Nest's DI to inject the implementation.
 * The application service receives the port, never the concrete
 * `RedisSocketConnectionRegistry` class.
 */
export const SOCKET_CONNECTION_REGISTRY_PORT = Symbol('SocketConnectionRegistryPort');

/**
 * Shape of the JWT payload the registry needs to function. We
 * re-declare the field rather than importing `JwtPayload` directly
 * to avoid an import-cycle worry: the gateway receives a fully-
 * populated `JwtPayload`, but the registry only needs `.sub`.
 */
export type _SocketConnectionUserContext = Pick<JwtPayload, 'sub'>;
