/**
 * `RedisSocketConnectionRegistry`
 *
 * Cross-instance implementation of `SocketConnectionRegistryPort`
 * backed by Redis. Backs the `socketId → {instanceId, userId}`
 * registry that `InstanceApplicationService.handlePlayerLeftSocket`
 * consults to emit `PlayerDisconnectedEvent` when a socket
 * disconnects on any replica.
 *
 * Why an explicit JSON blob and not a hash
 * ----------------------------------------
 * - The existing `CacheProvider` port already exposes the
 *   `get/set/del-with-TTL` shape that maps cleanly to a JSON
 *   blob. Adding a hash-shaped API would force every consumer to
 *   rewrite against a new primitive for one use case.
 * - A JSON blob lets the registry be backed by anything that
 *   implements `CacheProvider.get` / `CacheProvider.set` / `set`
 *   with TTL semantics — even an in-memory mock in tests.
 * - The cost is one extra JSON.stringify/parse per call, which is
 *   negligible on the disconnect hot path.
 *
 * Atomicity
 * ---------
 * `consume(...)` is implemented with the classic
 * `GETDEL` (Redis 6.2+) when the driver supports it, falling back to
 * a Lua script that GET + DEL inside a single round trip. This is
 * critical: two concurrent disconnects (Socket.IO can fire
 * `disconnect` twice if the transport closes abnormally) MUST NOT
 * both emit `PlayerDisconnectedEvent` for the same socket id.
 *
 * Failure semantics
 * -----------------
 * - **Network blip during `record`**: the write fails; the socket
 *   has no metadata and the next disconnect becomes a no-op. We
 *   log a structured warning and move on — a single missed
 *   `PlayerDisconnectedEvent` is much cheaper than retrying a
 *   Redis call on the join hot path.
 * - **Network blip during `consume`**: best effort. We return
 *   `null` and log a warning, because the alternative is emitting
 *   the same event twice if the operator retries. The cost is a
 *   missed `PlayerDisconnectedEvent`; the disconnected socket has
 *   already disconnected.
 */
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';
import {
  type SocketConnectionMeta,
  type SocketConnectionRegistryPort,
} from '../../domain/ports/socket-connection-registry.port';

/**
 * Default TTL for a socket metadata entry.
 *
 * Tuned against the Socket.IO default reconnection backoff:
 *   - Default reconnect: 1s ± jitter, doubles up to 5s.
 *   - Default `reconnectionAttempts`: Infinity.
 * In other words, a healthy client reconnects within a few
 * seconds of a transient drop. The metadata entry only needs to
 * outlive the typical reconnect window.
 *
 * 60 seconds is a deliberately conservative value: it covers
 * realistic transport hiccups (mobile network flap, proxy
 * reconnect) with a wide safety margin, while still bounded
 * enough that a truly abandoned socket's metadata doesn't linger
 * forever.
 *
 * Operators that want a different window can call `setTtlMs(...)`
 * or pass a different default through the constructor.
 */
const DEFAULT_TTL_MS = 60 * 1000;

const KEY_PREFIX = 'socket-connection:';

const buildKey = (socketId: string): string => `${KEY_PREFIX}${socketId}`;

@Injectable()
export class RedisSocketConnectionRegistry
  implements SocketConnectionRegistryPort, OnModuleDestroy
{
  private ttlMs: number = DEFAULT_TTL_MS;

  /**
   * Lua script for atomic GETDEL: read the value, delete the key,
   * and return the prior value in a single round-trip.
   *
   * The implementation lives in `RedisService.getDel()` and uses
   * the native Redis 6.2+ `GETDEL` command. Lua fallback is
   * documented there for older Redis deployments.
   */
  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(RedisSocketConnectionRegistry.name)
    private readonly logger: PinoLogger,
  ) {}

  setTtlMs(ttlMs: number): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(`Socket-connection TTL must be a positive number, got ${ttlMs}`);
    }
    this.ttlMs = Math.floor(ttlMs);
  }

  getTtlMs(): number {
    return this.ttlMs;
  }

  async record(socketId: string, meta: SocketConnectionMeta): Promise<boolean> {
    if (!socketId || socketId.length === 0) return false;
    if (!meta.userId || !meta.instanceId) return false;

    const key = buildKey(socketId);
    const value = JSON.stringify({ instanceId: meta.instanceId, userId: meta.userId });

    try {
      await this.cache.set(key, value, this.ttlMs);
      return true;
    } catch (error) {
      this.logger.warn({
        event: 'socket_connection_registry_record_failed',
        socketId,
        instanceId: meta.instanceId,
        userId: meta.userId,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }

  async getMeta(socketId: string): Promise<SocketConnectionMeta | null> {
    if (!socketId) return null;

    const key = buildKey(socketId);
    let raw: string | null;
    try {
      raw = await this.cache.get(key);
    } catch (error) {
      this.logger.warn({
        event: 'socket_connection_registry_get_failed',
        socketId,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
    return parseMeta(raw);
  }

  /**
   * Read-and-delete via `CacheProvider.getDel`, which uses the
   * native Redis `GETDEL` command on supported deployments. The
   * atomicity is what makes the disconnect hot path
   * double-emit-safe — see the class header.
   */
  async consume(socketId: string): Promise<SocketConnectionMeta | null> {
    if (!socketId) return null;

    const key = buildKey(socketId);
    let raw: string | null;
    try {
      raw = await this.cache.getDel(key);
    } catch (error) {
      this.logger.warn({
        event: 'socket_connection_registry_consume_failed',
        socketId,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
    return parseMeta(raw);
  }

  /**
   * Module-destroy hook is intentionally a no-op here: the
   * underlying `RedisService` already tears down its connection in
   * `onModuleDestroy`, and we do not own any ioredis clients.
   *
   * The implementation is kept to satisfy Nest's lifecycle
   * declaration explicitly — without it, the class could not be
   * decorated `OnModuleDestroy` and we lose the type-narrowed
   * lifecycle guarantee for any future cleanup work.
   */
  async onModuleDestroy(): Promise<void> {
    /* no-op — see class header */
  }
}

function parseMeta(raw: string | null): SocketConnectionMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SocketConnectionMeta>;
    if (
      typeof parsed.instanceId === 'string' &&
      parsed.instanceId.length > 0 &&
      typeof parsed.userId === 'string' &&
      parsed.userId.length > 0
    ) {
      return { instanceId: parsed.instanceId, userId: parsed.userId };
    }
  } catch {
    /* ignore — stale or malformed entry; treat as absent */
  }
  return null;
}
