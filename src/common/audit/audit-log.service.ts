/**
 * Cross-domain Audit Log Service
 *
 * Persists audit records for sensitive operations across all
 * domains. Writes to the existing `auth_audit_logs` table —
 * that table is intentionally generic (`user_id`, `event_type`,
 * `ip_address`, `metadata` jsonb, `created_at`, `expires_at`),
 * which is what the `DiscussionModeratorAuditService` already
 * relies on (`eventType: 'moderator_action'`).
 *
 * Why this exists
 * ---------------
 * Before this service, every module that needed auditing had to
 * either write its own INSERT into `auth_audit_logs` (as
 * `DiscussionModeratorAuditService` does) or call
 * `AuthAuditLogService`, which was scoped to auth events in
 * name only but had a narrow mental model that pushed callers
 * away from using it for non-auth events. The result: profile
 * changes, badge revocations, review moderation, and social
 * block/unblock actions went unaudited.
 *
 * This service keeps the existing table, the existing retention
 * policy, and the existing outbox-processor purge path. It
 * extends the record shape with two optional structured fields:
 *
 *   - `domain`   — broad domain tag (`'auth'`, `'user'`,
 *                  `'achievement'`, `'review'`, `'social'`,
 *                  `'quiz'`) for cross-domain reporting.
 *   - `action`   — sub-discriminator (e.g. `'badge.revoked'`,
 *                  `'review.report.status_changed'`) so the
 *                  free-form `eventType` column does not have to
 *                  encode the full namespace.
 *
 * `actorId` and `subjectUserId` are also optional: `actorId` is
 * the user (or admin) who performed the action, `subjectUserId`
 * is the user the action was performed on. For self-service
 * actions (the user updates their own profile), both are the
 * same value. For admin actions (admin revokes a badge), they
 * differ.
 *
 * Backward compatibility
 * ----------------------
 * The `AuthAuditLogService` in the auth module is preserved as
 * a thin wrapper around this service. Its existing callers
 * (outbox processor) keep working with no changes.
 */

import { Inject, Injectable } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';

/**
 * Coarse domain tag. New domains may be added as long as the
 * column stays short — the value lands in `metadata` as a
 * structured field, not the primary key, so widening later is
 * a metadata-only change.
 */
export type AuditDomain =
  | 'auth'
  | 'user'
  | 'achievement'
  | 'review'
  | 'social'
  | 'quiz'
  | 'discussion';

export type AuditRecordInput = {
  /**
   * The legacy free-form event identifier. Kept for backward
   * compatibility with the auth outbox, which writes values
   * like `password_changed`, `account_deleted`,
   * `session_revoked`. New code should prefer `domain` +
   * `action` instead of inventing new `eventType` strings.
   */
  eventType: string;
  /**
   * Broad domain tag for cross-domain reporting. Optional for
   * backward compatibility with auth outbox events.
   */
  domain?: AuditDomain;
  /**
   * Sub-discriminator within a domain, e.g. `'badge.revoked'`,
   * `'review.report.status_changed'`. Combined with `domain`
   * this gives `(domain, action)` as a stable key.
   */
  action?: string;
  /**
   * Who performed the action. For auth events this is the
   * subject user; for admin/moderator actions this is the
   * admin/moderator user. Falls back to `userId` and then
   * `subjectUserId` to keep backward compatibility.
   */
  actorId?: string;
  /**
   * The user the action was performed on. For self-service
   * actions (user updates their own profile) this is the same
   * as `actorId`. Falls back to `userId`.
   */
  subjectUserId?: string;
  /**
   * Legacy single-user field. If neither `actorId` nor
   * `subjectUserId` is set, the value is stored in the
   * `userId` column. If only `actorId` is set (admin acting
   * on a different user), `userId` is populated with
   * `subjectUserId ?? actorId` to keep the indexed `user_id`
   * column useful for "show me everything about this user"
   * queries.
   */
  userId?: string;
  /**
   * Originating IP, when known. Stored verbatim (no PII
   * truncation) because IP is the field the auth outbox also
   * writes — security investigations need the full address.
   */
  ipAddress?: string | null;
  /**
   * Free-form structured payload. JSONB column.
   */
  metadata?: Record<string, unknown>;
  /**
   * Override the timestamp. Defaults to `now`. Used by the
   * outbox processor to record the event with the same
   * `createdAt` as the outbox row, so a single audit log row
   * can be cross-referenced with its source event timestamp.
   */
  createdAt?: string;
  /**
   * Override the retention horizon in days. Defaults to the
   * auth-domain retention (`SecurityConfig.authAuditRetentionDays`)
   * for backward compatibility. Callers from domains with a
   * stricter compliance requirement (e.g. moderation) should
   * set this explicitly — the `DiscussionModeratorAuditService`
   * uses 365 days, which is the longest reasonable horizon for
   * an audit log of moderator actions.
   */
  retentionDays?: number;
};

/**
 * Default retention when a caller does not specify. Mirrors
 * the auth-domain default so the migration of existing callers
 * is a no-op for the retention horizon.
 */
const DEFAULT_AUDIT_RETENTION_DAYS = 90;

@Injectable()
export class AuditLogService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async record(input: AuditRecordInput): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const retentionDays = input.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
    const expiresAt = new Date(createdAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);

    // Index the audit row by the subject user when possible —
    // "show me everything that happened to user X" is the
    // single most common audit query. Admin actions where
    // actor != subject fall back to the subject so the indexed
    // column still gives the right answer.
    const indexedUserId = input.subjectUserId ?? input.actorId ?? input.userId ?? null;

    // Build a structured metadata payload that keeps the
    // original `metadata` untouched and prepends the
    // discriminator fields when they are present. Existing
    // consumers (e.g. dashboards) that look up the legacy
    // `aggregateType` field still see it; new consumers can
    // filter by `domain` / `action` instead.
    const metadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
    };
    if (input.domain !== undefined) metadata.domain = input.domain;
    if (input.action !== undefined) metadata.action = input.action;
    if (input.actorId !== undefined) metadata.actorId = input.actorId;
    if (input.subjectUserId !== undefined) metadata.subjectUserId = input.subjectUserId;

    await this.db.insert(authAuditLogs).values({
      eventType: input.eventType,
      userId: indexedUserId,
      ipAddress: input.ipAddress ?? null,
      metadata,
      createdAt,
      expiresAt: expiresAt.toISOString(),
    });
  }

  async purgeExpired(nowIso = new Date().toISOString()): Promise<number> {
    const result = await this.db
      .delete(authAuditLogs)
      .where(lt(authAuditLogs.expiresAt, nowIso))
      .returning({ auditLogId: authAuditLogs.auditLogId });

    return result.length;
  }
}
