/**
 * Ranking Outbox Port
 *
 * Port for scheduling ranking domain events into the transactional outbox.
 * Implementations must insert the event inside the same DB transaction as
 * the domain write to guarantee atomicity.
 *
 * ## Usage in repositories
 *
 * ```typescript
 * async atomicXpUpdate(params, outboxPort) {
 *   const tx = this.transactionalContext.getDbClient() ?? this.db;
 *   await tx.transaction(async (dbTx) => {
 *     await this.updateXpInTx(dbTx, params);
 *     await outboxPort.scheduleRankingEvent({ event, idempotencyKey }, dbTx);
 *   });
 * }
 * ```
 */

export interface RankingOutboxPort {
  /**
   * Schedules a ranking domain event for async dispatch.
   *
   * @param params - event metadata and optional idempotency key
   * @param tx - the active Drizzle transaction client. Required for atomicity.
   */
  scheduleRankingEvent(
    params: {
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      /** XP event idempotency key. Prevents double-processing. */
      idempotencyKey?: string;
    },
    tx: unknown,
  ): Promise<void>;
}

export const RANKING_OUTBOX_PORT = Symbol('RANKING_OUTBOX_PORT');
