/**
 * Moderation Audit Port
 *
 * Records moderator actions (`hide_comment`, `restore_comment`,
 * `review_report`) into the audit log. Two surfaces:
 *   - `logInsideTx(tx, params)` writes the audit row inside an
 *     existing transaction so the moderation state change and the
 *     audit row commit (or roll back) atomically.
 *   - `log(params)` writes the audit row independently — used for
 *     moderation paths that cannot be transactional (the service
 *     is responsible for routing the right call).
 *
 * Implementations live in `infrastructure/audit/`.
 */

export type ModerationAction = 'hide_comment' | 'restore_comment' | 'review_report';

export interface ModerationAuditParams {
  actorId: string;
  actorRole?: string;
  action: ModerationAction;
  targetType: 'comment' | 'report';
  targetId: string;
  reason?: string;
  result?: string;
}

export interface ModerationAuditTx {
  insert(table: unknown): {
    values(values: Record<string, unknown>): Promise<unknown>;
  };
}

export interface ModerationAuditPort {
  logInsideTx(tx: ModerationAuditTx, params: ModerationAuditParams): Promise<void>;
  log(params: ModerationAuditParams): Promise<void>;
}

export const COMMENT_MODERATION_AUDIT_PORT = Symbol('COMMENT_MODERATION_AUDIT_PORT');
