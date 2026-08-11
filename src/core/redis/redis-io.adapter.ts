/**
 * `RedisIoAdapter` — multi-instance Socket.IO via Redis pub/sub.
 *
 * Why this exists
 * ---------------
 * The default `IoAdapter` mounts an in-process Socket.IO server on top of
 * Nest's HTTP listener. That is correct for a single-process deployment,
 * but fails the moment the application is horizontally scaled: each
 * replica maintains its own room registry, so a `server.to(room).emit(...)`
 * on instance A only reaches clients that happen to be connected to A.
 * Players connected to instance B silently miss the event, even though
 * the application level thinks the broadcast succeeded.
 *
 * `@socket.io/redis-adapter` solves this by replacing the in-process
 * registry with a Redis-backed one: every emit, every room join, and
 * every leave is replicated across all instances via the configured
 * Redis pub/sub channel. The application code is unchanged —
 * `server.to(room).emit(...)` now genuinely reaches every client of
 * the room regardless of which instance they are attached to.
 *
 * Connection lifecycle
 * --------------------
 * The adapter needs two ioredis connections (`pubClient` and
 * `subClient`). We build them by reusing the `REDIS_URL` and the same
 * ioredis options `RedisService` already uses, so this adapter does not
 * pull in any new env config. The clients are owned by *this* adapter
 * instance — they are torn down in `close()` alongside the underlying
 * Socket.IO servers.
 *
 * Boot-time contract
 * ------------------
 * If Redis is unreachable the adapter throws during
 * `app.useWebSocketAdapter(...)` (or the first `createIOServer()`
 * call). That is intentional: Phase 3 turns Redis into a hard
 * dependency for horizontal scaling, and the cost of "boot, immediately
 * discover Redis is down, then accept HTTP traffic as if nothing
 * happened" is worse than a hard startup failure.
 *
 * Runtime contract
 * ----------------
 * Once connected, ioredis transparently reconnects if the Redis
 * connection drops. Socket.IO packets received during the outage are
 * buffered for a short window (`maxRetriesPerRequest = 3`); after that,
 * ioredis surfaces an error to the adapter, which treats it as a
 * dropped packet (normal Socket.IO semantics).
 *
 * What this adapter does NOT do
 * -----------------------------
 * - It does NOT replicate per-application state (counters, locks, etc.).
 *   That is `RedisService`'s job.
 * - It does NOT replicate the application-level `socketId → userId`
 *   registry used by `InstanceApplicationService.handlePlayerLeftSocket`.
 *   That is a higher-level concern solved by `SocketConnectionRegistry`
 *   (see `src/modules/instance/domain/ports/socket-connection-registry.port.ts`).
 * - It does NOT introduce any new env vars.
 */
import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import Redis from 'ioredis';

export type RedisIoAdapterOptions = {
  /**
   * Channel prefix used by the adapter for its pub/sub traffic.
   * Defaults to `socket.io` (the upstream default). Override only if
   * multiple independent Socket.IO clusters share a single Redis.
   */
  key?: string;

  /**
   * ioredis connection options. Defaults mirror `RedisService.redisOptions`
   * (maxRetriesPerRequest=3, enableReadyCheck=true, exponential backoff).
   *
   * Override only if the Redis deployment requires a non-default
   * topology (TLS, sentinel, etc.).
   */
  redisOptions?: {
    maxRetriesPerRequest?: number;
    retryStrategy?: (times: number) => number | null;
  };

  /**
   * Override the underlying Redis URL. Defaults to `process.env.REDIS_URL`.
   * Exposed for tests; production callers should rely on the env var.
   */
  redisUrl?: string;
};

export class RedisIoAdapter extends IoAdapter {
  private readonly logger: PinoNestLogger;
  private readonly adapterOptions: RedisIoAdapterOptions;

  /**
   * The two ioredis connections the adapter owns. They are created
   * lazily on the first `createIOServer()` call so the application's
   * `useWebSocketAdapter()` call itself stays synchronous and cheap.
   * Both clients are torn down in `close()`.
   *
   * Why two clients and not one duplicate: once a connection enters
   * subscribe mode (which `subClient` must), it can no longer run any
   * normal Redis commands. Using the same physical connection for both
   * roles is therefore impossible — see the Socket.IO Redis adapter
   * docs.
   */
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private redisClientsClosed = false;

  constructor(app: INestApplicationContext, options: RedisIoAdapterOptions = {}) {
    super(app);
    this.adapterOptions = options;
    // `IoAdapter` is instantiated by the caller (`useWebSocketAdapter`)
    // outside of Nest's DI container, so we cannot rely on the
    // `@InjectPinoLogger` parameter decorator here.
    //
    // We pull the singleton `Logger` that `nestjs-pino` exposes
    // globally through its root `LoggerModule`. `Logger` (note: this
    // is `nestjs-pino`'s wrapper, NOT @nestjs/common's `Logger`)
    // is a `Scope.DEFAULT` singleton and is therefore safe to fetch
    // via `app.get()` from a non-DI caller.
    //
    // Internally, every call goes through `PinoLogger.call(...)`,
    // which prepends the bound `context` field and writes to the
    // SAME underlying Pino instance — including the redaction paths
    // and serializers defined in `core/logger/pino.config.ts`. That
    // matters because the Pino redact paths are the single source of
    // truth for what may never reach a log file; routing the
    // Socket.IO adapter through Pino guarantees Socket.IO logs are
    // inspected by the same redaction logic as HTTP logs.
    //
    // We do NOT use `app.get(PinoLogger)` directly because
    // `PinoLogger` is registered with `Scope.TRANSIENT`, which is
    // incompatible with `app.get()` from a non-DI caller (Nest
    // requires `resolve()` for transient / request-scoped providers).
    //
    // We also do NOT fall back to @nestjs/common's `console.*`
    // `Logger`, because that would silently bypass our redaction
    // paths.
    //
    // `Logger` (the `@nestjs/common` interface that `nestjs-pino`'s
    // `Logger` implements) does NOT expose `setContext`. The
    // `nestjs-pino` wrapper derives the context from the LAST
    // argument passed to `log()/error()/warn()/...`, so we tag
    // each call with `RedisIoAdapter.name` as the trailing context
    // argument. Every log emitted through this adapter will
    // therefore carry `context: "RedisIoAdapter"` in the JSON output.
    const logger = app.get(PinoNestLogger, { strict: false });
    if (!logger) {
      throw new Error(
        'nestjs-pino Logger is not available — CoreLoggerModule must be registered before useWebSocketAdapter()',
      );
    }
    this.logger = logger;
  }

  private logContext(): string {
    return RedisIoAdapter.name;
  }

  /**
   * Override the Socket.IO factory so every namespace-level `Server`
   * gets the Redis adapter applied before being handed back to Nest.
   *
   * `IoAdapter.create(port, { namespace })` calls this method for each
   * namespace and then `.of(namespace)`s the result. By installing the
   * adapter here, every Server we create has the adapter bound —
   * upstream code cannot accidentally override it.
   */
  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    const { pubClient, subClient } = this.ensureRedisClients();
    server.adapter(
      createAdapter(pubClient, subClient, {
        key: this.adapterOptions.key ?? 'socket.io',
      }),
    );

    this.logger.log(
      {
        event: 'socket.adapter.attached',
        port,
      },
      this.logContext(),
    );

    return server;
  }

  /**
   * Tear down the Socket.IO server AND the adapter-owned ioredis
   * connections. `super.close(server)` is responsible for closing the
   * Socket.IO server; we own the Redis connections.
   *
   * Nest calls `adapter.close(server)` once per Server that was created
   * via `createIOServer(...)`. We must NOT double-close the Redis
   * clients, so we guard with `redisClientsClosed`.
   */
  async close(server: Server): Promise<void> {
    await super.close(server);
    if (this.redisClientsClosed) return;
    this.redisClientsClosed = true;

    for (const client of [this.pubClient, this.subClient]) {
      if (!client) continue;
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
    this.pubClient = null;
    this.subClient = null;
  }

  /**
   * Build the two ioredis clients the adapter needs on first use. We
   * do NOT use `RedisService.createSubscriber()` because the Socket.IO
   * adapter requires two SEPARATE ioredis clients (one for pub, one
   * for sub), not just one subscriber. Both clients use the same
   * validated URL and connection options the rest of the application
   * uses.
   */
  private ensureRedisClients(): { pubClient: Redis; subClient: Redis } {
    if (this.pubClient && this.subClient) {
      return { pubClient: this.pubClient, subClient: this.subClient };
    }

    const url = this.adapterOptions.redisUrl ?? process.env.REDIS_URL;
    if (!url || url.trim().length === 0) {
      throw new Error(
        'REDIS_URL is not defined — Socket.IO Redis adapter requires a live Redis instance',
      );
    }

    const options = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      ...this.adapterOptions.redisOptions,
    };

    this.pubClient = new Redis(url, options);
    this.subClient = new Redis(url, options);

    this.pubClient.on('error', (err: Error) => this.handleClientError('pubClient', err));
    this.subClient.on('error', (err: Error) => this.handleClientError('subClient', err));

    return { pubClient: this.pubClient, subClient: this.subClient };
  }

  private handleClientError(label: 'pubClient' | 'subClient', err: Error): void {
    this.logger.error(
      {
        event: 'socket.adapter.client_error',
        client: label,
        message: err.message,
      },
      this.logContext(),
    );
  }
}
