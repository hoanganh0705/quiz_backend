/**
 * LISTEN/NOTIFY-driven outbox processor.
 *
 * Phase 2 #2 of the resilience roadmap (see `BACKEND_AUDIT_REPORT.md`
 * §23 Phase 2).
 *
 * Replaces the per-minute polling with a Postgres `LISTEN outbox_events`
 * channel. Producers emit `NOTIFY outbox_events, '<event_id>'` from
 * the same transaction that writes the row to `outbox_events`. This
 * drops the worst-case latency from ≤ 60s to ≤ 1s in the happy path
 * and removes the per-event pure overhead of the `@Cron` loop.
 *
 * Fallback strategy
 * -----------------
 * `LISTEN` connections are not durable — they drop on TCP reset,
 * Postgres restart, or PgBouncer's connection reaper. When the
 * connection drops, the listener re-establishes it and we would
 * miss every event emitted in the gap. To make the system
 * self-healing, we register a *fallback* poll that runs every
 * 30 seconds. The poll will normally find nothing (every event
 * already processed by the `LISTEN` path) but it guarantees no
 * event sits in the queue for more than 30s even after a
 * connection reset.
 *
 * Why a separate service?
 * -----------------------
 * The existing `OutboxProcessorService` is already a NestJS
 * singleton with `@Cron` fields. The cleanest split is to keep
 * the dispatcher logic in one place (`processPendingEvents`) and
 * add a *trigger* in a separate service that:
 *   1. Opens a dedicated `pg.Client` with `LISTEN outbox_events`.
 *   2. On `notification`, calls `processPendingEvents()`.
 *   3. Reconnects with backoff on connection loss.
 *   4. Runs the 30s fallback poll.
 *
 * The trigger is a `@Injectable` that listens for the `pg`
 * `'notification'` event and forwards to the existing processor.
 * No changes to the dispatch logic are required — the SELECT +
 * UPDATE flow is identical.
 */

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { OutboxProcessorService } from './outbox-processor.service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export const OUTBOX_NOTIFY_CHANNEL = 'outbox_events';

type DrizzleLike = NodePgDatabase<Record<string, unknown>> | DrizzleDB;

@Injectable()
export class OutboxNotifyListener implements OnModuleInit, OnModuleDestroy {
  private readonly reconnectDelaysMs = [100, 500, 1_000, 5_000, 10_000];
  private listenerClient: import('pg').Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private fallbackInFlight = false;
  private notifyInFlight = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleLike,
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
    const drizzleDb = this.db as unknown as { $client: Pool };
    // The Drizzle pg driver exposes the underlying pg.Pool as
    // `$client`. We read its `options.connectionString` rather than
    // reaching for an env var directly so the listener *cannot*
    // drift from the rest of the app's DB config.
    const pool = drizzleDb.$client;
    const options = (pool as unknown as { options: { connectionString?: string } }).options;
    const url = options.connectionString;
    if (!url) {
      throw new Error('OutboxNotifyListener: cannot resolve DB connection string from Drizzle pool');
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
      } catch {
        // best-effort
      }
      await this.listenerClient.end();
      this.listenerClient = null;
    }
  }

  /**
   * Open the dedicated listener connection and `LISTEN` on the
   * outbox channel. The connection is held for the lifetime of the
   * process — Postgres notifies arrive without polling.
   */
  private async connect(): Promise<void> {
    try {
      const { Client } = await import('pg');
      this.listenerClient = new Client({ connectionString: this.connectionString });

      this.listenerClient.on('notification', (msg) => {
        if (msg.channel !== OUTBOX_NOTIFY_CHANNEL) return;
        this.handleNotify(msg.payload).catch((err) => {
          this.logger.error({
            event: 'auth_outbox_notify_handler_failed',
            message: err instanceof Error ? err.message : String(err),
          });
        });
      });

      this.listenerClient.on('error', (err) => {
        this.logger.warn({
          event: 'auth_outbox_notify_listener_error',
          message: err instanceof Error ? err.message : String(err),
        });
      });

      this.listenerClient.on('end', () => {
        this.logger.warn({ event: 'auth_outbox_notify_listener_disconnected' });
        this.scheduleReconnect();
      });

      await this.listenerClient.connect();
      await this.listenerClient.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);

      this.logger.info({ event: 'auth_outbox_notify_listener_started' });
    } catch (error) {
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