import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Cron } from '@nestjs/schedule';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { OutboxProcessorService } from './outbox-processor.service';

export const OUTBOX_NOTIFY_CHANNEL = 'outbox_events';

interface PgNotification {
  channel: string;
  payload?: string;
}

interface PgErrorEvent {
  message: string;
}

interface PgClientConstructor {
  new (config: { connectionString: string }): ListenerClient;
}

/**
 * Subset of `pg.Client` that the listener actually consumes. Modelling
 * the dependency as a structural type (instead of importing the whole
 * `pg.Client`) keeps `eslint-plugin-no-unsafe-*` quiet at every call
 * site without resorting to `as any` casts.
 */
interface ListenerClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string): Promise<unknown>;
  on(event: 'notification', listener: (msg: PgNotification) => void): void;
  on(event: 'error', listener: (err: PgErrorEvent) => void): void;
  on(event: 'end', listener: () => void): void;
}

@Injectable()
export class OutboxNotifyListener implements OnModuleInit, OnModuleDestroy {
  private readonly reconnectDelaysMs = [100, 500, 1_000, 5_000, 10_000];
  private listenerClient: ListenerClient | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private fallbackInFlight = false;
  private notifyInFlight = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly processor: OutboxProcessorService,
    @InjectPinoLogger(OutboxNotifyListener.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Read the connection string from the underlying pool. We can't
   * share the pool's connection (LISTEN holds a connection for the
   * lifetime of the subscription) but we can share the URL.
   */
  private get connectionString(): string {
    // The Drizzle pg driver exposes the underlying pg.Pool as
    // `$client`. We read its `options.connectionString` rather than
    // reaching for an env var directly so the listener *cannot*
    // drift from the rest of the app's DB config.
    const pool = (this.db as unknown as { $client: { options: { connectionString?: string } } })
      .$client;
    const url = pool.options.connectionString;
    if (!url) {
      throw new Error(
        'OutboxNotifyListener: cannot resolve DB connection string from Drizzle pool',
      );
    }
    return url;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.listenerClient) {
      try {
        await this.listenerClient.query(`UNLISTEN ${OUTBOX_NOTIFY_CHANNEL}`);
      } catch (error: unknown) {
        // best-effort: surface unexpected errors but keep teardown
        // moving. Swallowing is intentional — UNLISTEN on an already-
        // closed connection is the typical failure mode here.
        this.logger.debug({
          event: 'auth_outbox_notify_unlisten_failed',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
      await this.listenerClient.end();
      this.listenerClient = null;
    }
  }

  /**
   * Open the dedicated listener connection and `LISTEN` on the
   * outbox channel. The connection is held for the lifetime of the
   * process — Postgres notifies arrive without polling.
   *
   * The dynamic import + structural cast are intentional: `pg.Client`
   * is resolved by `pg`'s package types as `any`-shaped in this
   * project, and any direct field access would trip
   * `@typescript-eslint/no-unsafe-*`. Confining the boundary to
   * `ListenerClient` keeps the rest of the file lint-clean.
   */
  private async connect(): Promise<void> {
    try {
      const pgModule = (await import('pg')) as unknown as { Client: PgClientConstructor };
      this.listenerClient = new pgModule.Client({
        connectionString: this.connectionString,
      });

      this.listenerClient.on('notification', (msg: PgNotification) => {
        if (msg.channel !== OUTBOX_NOTIFY_CHANNEL) return;
        this.handleNotify(msg.payload).catch((err: unknown) => {
          this.logger.error({
            event: 'auth_outbox_notify_handler_failed',
            message: err instanceof Error ? err.message : String(err),
          });
        });
      });

      this.listenerClient.on('error', (err: PgErrorEvent) => {
        this.logger.warn({
          event: 'auth_outbox_notify_listener_error',
          message: err.message,
        });
      });

      this.listenerClient.on('end', () => {
        this.logger.warn({ event: 'auth_outbox_notify_listener_disconnected' });
        this.scheduleReconnect();
      });

      await this.listenerClient.connect();
      await this.listenerClient.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);

      this.logger.info({ event: 'auth_outbox_notify_listener_started' });
    } catch (error: unknown) {
      this.logger.warn({
        event: 'auth_outbox_notify_listener_connect_failed',
        message: error instanceof Error ? error.message : String(error),
      });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelaysMs[0] ?? 1_000;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  /**
   * Handle a `NOTIFY` payload. The payload is the `<event_id>` of
   * the row that was just inserted. We forward to the existing
   * processor which SELECTs the event by id-equivalent (the
   * existing query selects all pending events, so the early
   * `processPendingEvents` call picks up the fresh row).
   *
   * Single-flight: if a previous `NOTIFY` is still draining, we
   * skip this round. The next NOTIFY (or the next fallback poll)
   * will catch up.
   */
  private async handleNotify(payload: string | undefined): Promise<void> {
    if (!payload) return;
    if (this.notifyInFlight) return;
    this.notifyInFlight = true;
    try {
      await this.processor.processPendingEvents();
    } finally {
      this.notifyInFlight = false;
    }
  }

  /**
   * Fallback poll. Runs every 30 seconds so that any event
   * missed by `LISTEN` (e.g. emitted during a connection reset)
   * is dispatched within 30s even without a fresh NOTIFY.
   *
   * The fallback is *idempotent*: `processPendingEvents` only
   * acts on rows where `processed_at IS NULL`, so running it
   * twice in a row is a no-op.
   */
  @Cron('*/30 * * * * *')
  async fallbackPoll(): Promise<void> {
    if (this.fallbackInFlight) return;
    this.fallbackInFlight = true;
    try {
      await this.processor.processPendingEvents();
    } catch (error) {
      this.logger.warn({
        event: 'auth_outbox_fallback_poll_failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.fallbackInFlight = false;
    }
  }
}
