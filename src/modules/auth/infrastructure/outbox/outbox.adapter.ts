import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { OutboxPort } from '../../domain/ports/outbox.port';

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
    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: params.aggregateType,
        eventType: params.eventType,
        payload: params.payload,
        createdAt: params.nowIso,
        idempotencyKey,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
      });
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
