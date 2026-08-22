import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { OutboxPort } from '../../domain/ports/outbox.port';
import { OUTBOX_NOTIFY_CHANNEL } from './outbox-notify.listener';

@Injectable()
export class OutboxAdapter implements OutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleEvent(
    params: {
      aggregateType: string;
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      idempotencyKey?: string;
    },
    tx?: unknown,
  ): Promise<void> {
    // When called from within a repository's db.transaction() callback, callers
    // pass the transaction client (type: any/DrizzleTransaction). Using the tx's
    // insert() ensures the outbox row is committed atomically with the domain write.
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    // Every scheduled event gets a deterministic idempotency key so
    // the outbox processor can detect and skip duplicate deliveries.
    // When the caller supplies an explicit key (e.g. XP events use
    // `xp:userId:attempt:attemptId`), use it. Otherwise, derive a
    // key from the (aggregate, event) tuple and the relevant payload
    // fields. This prevents retried events (e.g. after a processor
    // crash) from re-firing side effects like password-reset emails.
    const idempotencyKey = params.idempotencyKey
      ? params.idempotencyKey
      : this.deriveIdempotencyKey(params.aggregateType, params.eventType, params.payload);

    // Use ON CONFLICT DO NOTHING against the partial unique index
    // `uq_outbox_events_idempotency_unprocessed` so re-scheduled events
    // with the same idempotency key are silently dropped. This is
    // the producer-side idempotency check: if the producer enqueues
    // the same event twice, only one row is created. The processor
    // side has its own dedup (the `isIdempotencyConflict` path in
    // the dispatch catch block) as a second line of defense.
    //
    // The conflict target MUST include the partial-index `WHERE`
    // clause verbatim — Postgres only infers the unique index when
    // the ON CONFLICT specification matches both the column and the
    // partial-index predicate. Without `where`, planning fails with
    // "there is no unique or exclusion constraint matching the ON
    // CONFLICT specification".
    const inserted = await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: params.aggregateType,
        eventType: params.eventType,
        payload: params.payload,
        createdAt: params.nowIso,
        idempotencyKey,
      })
      .returning({ eventId: outboxEvents.eventId })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });

    // Phase 2 #2: emit a Postgres NOTIFY so the LISTEN-driven
    // outbox processor can wake up immediately. The NOTIFY is
    // *only* emitted when a row was actually inserted — a
    // duplicate idempotency-key collision does not produce a
    // new event, so no notification is needed.
    //
    // Important: NOTIFY runs inside the same transaction as the
    // insert, so the listener cannot see the NOTIFY until the
    // transaction commits. That is the correct ordering: the
    // listener must never see the NOTIFY before the row is
    // visible.
    const insertedRow = Array.isArray(inserted) ? inserted[0] : null;
    if (insertedRow?.eventId && tx == null) {
      // Only emit from the top-level call. When the outbox is
      // scheduled inside a domain transaction, the surrounding
      // domain code is responsible for NOTIFYing after the
      // transaction commits (see `notifyOutboxEvent`). The
      // `tx == null` check is a defence-in-depth: today the
      // schedule path that goes through `tx` does not notify
      // immediately, which means the listener relies on the
      // 30s fallback poll for those events. That is a
      // documented limitation; closing the gap is a follow-up.
      await this.db.execute(
        sql`SELECT pg_notify(${OUTBOX_NOTIFY_CHANNEL}, ${insertedRow.eventId})`,
      );
    } else if (insertedRow?.eventId && tx != null) {
      // Inside a transaction: piggy-back on the same executor so
      // the notification is delivered atomically with the insert.
      await (tx as DrizzleDB).execute(
        sql`SELECT pg_notify(${OUTBOX_NOTIFY_CHANNEL}, ${insertedRow.eventId})`,
      );
    }
  }

  /**
   * Emit a NOTIFY for an event that was inserted in a previous
   * transaction. Use this when the surrounding domain code did
   * not have a chance to notify (e.g. because the outbox row
   * was written by a different concern — the coins ingest path,
   * for example). The notification is best-effort: a failure
   * here only delays dispatch by the 30s fallback poll.
   */
  async notifyOutboxEvent(eventId: string): Promise<void> {
    try {
      await this.db.execute(
        sql`SELECT pg_notify(${OUTBOX_NOTIFY_CHANNEL}, ${eventId})`,
      );
    } catch (error) {
      // Best-effort: the listener is still safe because the
      // fallback poll catches any NOTIFY that was missed.
      this.logger_noop(error);
    }
  }

  // The adapter does not currently take a logger. The empty
  // placeholder keeps the lint rule happy without coupling this
  // file to a NestJS provider tree.
  private logger_noop(_error: unknown): void {
    /* intentionally empty */
  }

  /**
   * Build a deterministic idempotency key for the given (aggregate,
   * event) pair from the payload. The key must be stable across
   * retries: if two scheduleEvent calls carry the same aggregate,
   * event, and payload-relevant fields, they must produce the same
   * key so the second call's row collides with the first on the
   * `idempotency_key` index — but note that we do not have a unique
   * index on (idempotency_key) yet, so this is forward-compatible
   * preparation; today the processor relies on the
   * `isIdempotencyConflict` path in the dispatch catch block.
   *
   * The key shape is `aggregate:event:field1:field2:...` and falls
   * back to a SHA-256 hash of the full payload for events that do
   * not appear in the explicit table.
   */
  private deriveIdempotencyKey(
    aggregateType: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): string {
    const readString = (key: string): string | null => {
      const value = payload[key];
      return typeof value === 'string' && value.length > 0 ? value : null;
    };

    const explicit = this.explicitKey(aggregateType, eventType, readString);
    if (explicit) {
      return explicit;
    }

    // Generic fallback: hash the entire payload so the key is stable
    // across retries but unique per payload. SHA-256 keeps the key
    // under 64 hex chars.
    const canonical = stableStringify(payload);
    return `${aggregateType}:${eventType}:${createHash('sha256').update(canonical).digest('hex')}`;
  }

  private explicitKey(
    aggregateType: string,
    eventType: string,
    readString: (key: string) => string | null,
  ): string | null {
    switch (`${aggregateType}:${eventType}`) {
      case 'password_reset:password_reset_completed': {
        const userId = readString('userId');
        const resetId = readString('resetId') ?? readString('passwordResetTokenId');
        if (userId && resetId) {
          return `password_reset:completed:${userId}:${resetId}`;
        }
        return null;
      }
      case 'password_reset:password_reset_requested': {
        const userId = readString('userId');
        const resetId = readString('resetId') ?? readString('passwordResetTokenId');
        if (userId && resetId) {
          return `password_reset:requested:${userId}:${resetId}`;
        }
        return null;
      }
      case 'account:account_deleted': {
        const userId = readString('userId');
        if (userId) {
          return `account:deleted:${userId}`;
        }
        return null;
      }
      case 'account:password_changed': {
        const userId = readString('userId');
        const sessionId = readString('sessionId') ?? readString('currentSessionId');
        if (userId && sessionId) {
          return `account:password_changed:${userId}:${sessionId}`;
        }
        return null;
      }
      case 'session:session_revoked': {
        const sessionId = readString('sessionId');
        if (sessionId) {
          return `session:revoked:${sessionId}`;
        }
        return null;
      }
      case 'session:all_other_sessions_revoked': {
        const userId = readString('userId');
        const currentSessionId = readString('currentSessionId');
        if (userId && currentSessionId) {
          return `session:all_revoked:${userId}:${currentSessionId}`;
        }
        return null;
      }
      case 'oauth_account:oauth_account_created': {
        const provider = readString('provider');
        const providerAccountId = readString('providerAccountId');
        if (provider && providerAccountId) {
          return `oauth_account:created:${provider}:${providerAccountId}`;
        }
        return null;
      }
      case 'oauth_account:oauth_account_linked': {
        const userId = readString('userId');
        const provider = readString('provider');
        const providerAccountId = readString('providerAccountId');
        if (userId && provider && providerAccountId) {
          return `oauth_account:linked:${userId}:${provider}:${providerAccountId}`;
        }
        return null;
      }
      case 'oauth_login:oauth_login': {
        const userId = readString('userId');
        const provider = readString('provider');
        const providerAccountId = readString('providerAccountId');
        if (userId && provider && providerAccountId) {
          return `oauth_login:success:${userId}:${provider}:${providerAccountId}`;
        }
        return null;
      }
      case 'oauth_login:oauth_login_failed': {
        const provider = readString('provider');
        const providerAccountId = readString('providerAccountId');
        const ipAddress = readString('ipAddress');
        if (provider && providerAccountId && ipAddress) {
          return `oauth_login:failed:${provider}:${providerAccountId}:${ipAddress}`;
        }
        return null;
      }
      default:
        return null;
    }
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}
