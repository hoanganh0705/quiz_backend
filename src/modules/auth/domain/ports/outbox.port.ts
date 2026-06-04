/**
 * Port for the transactional outbox pattern.
 *
 * Implementations must write every event into the outbox table INSIDE the same
 * database transaction as the domain operation that caused it. A background
 * processor reads unprocessed rows and dispatches them to downstream consumers
 * (email, webhooks, SIEM, etc.), then marks them as processed.
 *
 * This guarantees at-least-once delivery: if the process crashes after the
 * domain transaction commits but before the outbox processor runs, the event is
 * recovered on next startup. Consumers must be idempotent.
 *
 * ## Transactional participation
 *
 * Callers that manage their own transactions MUST pass the transaction client
 * to `scheduleEvent`. This ensures the outbox row is committed atomically with
 * the domain write. Example:
 *
 *   await db.transaction(async (tx) => {
 *     await userRepo.updatePassword({ ... }, tx);      // domain write
 *     await outbox.scheduleEvent({ ... }, tx);           // same transaction
 *   });
 *
 * Callers that use repository atomic methods (which manage their own transactions)
 * do NOT pass a tx — the repository's atomic method will call scheduleEvent
 * from within its own transaction, passing the internal tx client.
 */
export interface OutboxPort {
  /**
   * Schedules an event to be published.
   *
   * @param params - event metadata
   * @param tx - optional transaction client. When provided, the outbox row is
   *   inserted inside that transaction. When omitted, the adapter auto-commits
   *   independently (only use outside of transactional flows).
   */
  scheduleEvent(
    params: {
      aggregateType: string;
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
    },
    tx?: unknown,
  ): Promise<void>;
}

export const OUTBOX_PORT = Symbol('OUTBOX_PORT');
