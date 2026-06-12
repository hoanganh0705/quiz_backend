/**
 * Achievement Outbox Port
 *
 * Defines the interface for writing achievement domain events to the transactional
 * outbox. Implementations must write every event INSIDE the same database transaction
 * as the domain operation that caused it.
 *
 * ## Usage
 *
 * When the repository manages its own transaction, it passes the transaction client
 * to ensure atomicity:
 *
 *   await this.db.transaction(async (tx) => {
 *     await this.awardBadge(params, tx);      // domain write
 *     await outbox.scheduleAchievementEvent({ ... }, tx); // same transaction
 *   });
 */
export interface AchievementOutboxPort {
  /**
   * Schedule an achievement domain event to be published.
   *
   * @param params - event metadata (aggregateType, eventType, payload, nowIso)
   * @param tx - transaction client. When provided, the outbox row is inserted
   *   inside that transaction. When omitted, the adapter auto-commits independently.
   */
  scheduleAchievementEvent(
    params: {
      aggregateType: string;
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
    },
    tx?: unknown,
  ): Promise<void>;
}

export const ACHIEVEMENT_OUTBOX_PORT = Symbol('ACHIEVEMENT_OUTBOX_PORT');
