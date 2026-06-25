/**
 * Session Invalidation Bus
 *
 * Cross-instance pub/sub for session-revocation events.
 *
 * Why this exists
 * ---------------
 * When an instance revokes a session (e.g. via the "sign out other
 * devices" flow), it writes `revoked_at` to the database. Other
 * instances only learn about the revocation when they next look up
 * the session in the database. In a multi-instance deployment this
 * creates a window during which a user connected to instance B can
 * still use a session that instance A has just revoked.
 *
 * To close that window, the auth service publishes a revocation
 * event on a Redis pub/sub channel. Every instance — including the
 * one that originated the revocation — subscribes to the channel
 * and pushes the revoked identifier into a local in-memory
 * deny-list. The read path consults the deny-list before hitting
 * the database, so a revoked session is rejected immediately on
 * every instance.
 *
 * Event shape
 * -----------
 * Each event carries a `kind` discriminator and the identifier
 * (session id, jti, or refresh-token hash) that should be denied
 * for the next few minutes. The deny-list entry expires
 * automatically (TTL = SESSION_INVALIDATION_TTL_MS); after that,
 * the database is again the source of truth.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';
import { PUBSUB_PROVIDER } from '@/common/ports/pubsub.provider';
import { sessionsConfig } from '@/core/config';

/**
 * How long a single in-process deny-list entry lives. Must be long
 * enough to cover the typical cross-instance replication window
 * (a few seconds), and short enough that a denial does not
 * accidentally outlive the underlying revoked session in the
 * database. Five minutes is generous; the database is the source
 * of truth past that point.
 */
const SESSION_INVALIDATION_TTL_MS = 5 * 60 * 1000;

export type SessionInvalidationKind = 'session' | 'jti' | 'refresh_token_hash' | 'all_for_user';

export type SessionInvalidationEvent = {
  /**
   * Discriminator. `all_for_user` covers both `revokeAllActiveSessions`
   * and `revokeOtherActiveSessions` because the read path can short-
   * circuit a user with a single deny-list hit.
   */
  kind: SessionInvalidationKind;
  /**
   * Identifier to deny. For `all_for_user` this is the user id; the
   * read path denies any session that resolves to that user.
   */
  identifier: string;
  /**
   * Optional session id (used by `revokeSessionById` and as
   * redundant context for `all_for_user`).
   */
  sessionId?: string;
  /**
   * Optional JTI. Carried alongside `sessionId` when known so that
   * the read path can deny a session lookup by either key.
   */
  jti?: string;
  /**
   * Optional refresh-token hash. Carried so that the
   * `auth-refresh` flow can deny a refresh attempt by hash even
   * after the session has been rotated.
   */
  refreshTokenHash?: string;
  /**
   * Who issued the revocation. Informational only.
   */
  reason?: string;
  /**
   * Server-issued timestamp (ms since epoch).
   */
  emittedAtMs: number;
};

export type SessionInvalidationHandler = (event: SessionInvalidationEvent) => void;

@Injectable()
export class SessionInvalidationBus implements OnModuleInit, OnModuleDestroy {
  private readonly channel: string;
  private subscriber: Redis | null = null;
  private readonly handlers = new Set<SessionInvalidationHandler>();

  constructor(
    @Inject(PUBSUB_PROVIDER)
    private readonly pubSub: PubSubProvider,
    @Inject(sessionsConfig.KEY)
    private readonly sessions,
    @InjectPinoLogger(SessionInvalidationBus.name)
    private readonly logger: PinoLogger,
  ) {
    this.channel = this.sessions.authSessionInvalidationChannel;
  }

  async onModuleInit(): Promise<void> {
    // `createSubscriber` returns a dedicated ioredis client because
    // pub/sub subscribers cannot share a connection with normal
    // commands — once a connection is in subscribe mode it can
    // only run subscribe/unsubscribe/ping.
    const subscriber = this.pubSub.createSubscriber();
    this.subscriber = subscriber;

    subscriber.on('error', (error) => {
      this.logger.error({
        event: 'session_invalidation_subscriber_error',
        message: error.message,
      });
    });

    await subscriber.subscribe(this.channel);
    subscriber.on('message', (channel, raw) => {
      if (channel !== this.channel) return;
      let parsed: SessionInvalidationEvent | null = null;
      try {
        parsed = JSON.parse(raw) as SessionInvalidationEvent;
      } catch (error) {
        this.logger.warn({
          event: 'session_invalidation_malformed_message',
          message: error instanceof Error ? error.message : 'unknown',
        });
        return;
      }
      for (const handler of this.handlers) {
        try {
          handler(parsed);
        } catch (error) {
          this.logger.error({
            event: 'session_invalidation_handler_error',
            message: error instanceof Error ? error.message : 'unknown',
          });
        }
      }
    });

    this.logger.info({
      event: 'session_invalidation_bus_subscribed',
      channel: this.channel,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(this.channel);
      } catch {
        // best-effort
      }
      try {
        await this.subscriber.quit();
      } catch {
        // best-effort
      }
      this.subscriber = null;
    }
  }

  /**
   * Register an in-process handler. Returns an unsubscribe function.
   * The handler is invoked synchronously on the pub/sub thread —
   * it should not perform blocking I/O without a `void`/fire-and-
   * forget.
   */
  onInvalidation(handler: SessionInvalidationHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Publish a session-invalidation event to every instance. Returns
   * the number of subscribers that received the event (0 is normal
   * during a deploy).
   */
  async publish(event: Omit<SessionInvalidationEvent, 'emittedAtMs'>): Promise<number> {
    const fullEvent: SessionInvalidationEvent = {
      ...event,
      emittedAtMs: Date.now(),
    };
    try {
      return await this.pubSub.publish(this.channel, fullEvent);
    } catch (error) {
      this.logger.error({
        event: 'session_invalidation_publish_failed',
        kind: fullEvent.kind,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return 0;
    }
  }

  /**
   * How long a deny-list entry should live in memory. Exposed so
   * the consumer (SessionService) can use the same constant when
   * it consults the deny-list.
   */
  get denyListTtlMs(): number {
    return SESSION_INVALIDATION_TTL_MS;
  }
}
