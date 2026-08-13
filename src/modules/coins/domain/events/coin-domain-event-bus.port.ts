/**
 * Coin Domain Event Bus Port
 *
 * Mirrors the `RankingDomainEventBusPort` shape exactly. Subscribers get a
 * `CoinDomainEvent` and the bus filters by `eventType` internally.
 *
 * The bus is purely in-process (Phase 3 only — cross-process realtime
 * push is Phase 5). It is the dispatch surface for:
 *
 *   - `CoinOutboxProcessorService` → emits `CoinBalanceChangedEvent` and
 *     `CoinTransactionRecordedEvent` after the outbox row is marked
 *     processed.
 *   - `CoinGateway` (Phase 5) → subscribes to `CoinBalanceChangedEvent`
 *     and forwards to the WebSocket room `user:{userId}`.
 */

import type {
  CoinBalanceChangedEvent,
  CoinTransactionRecordedEvent,
  CoinDomainEvent,
} from './coin-domain.events';

export interface CoinDomainEventBusPort {
  /**
   * Subscribe to all coin domain events. Returns an unsubscribe function.
   * The handler is invoked synchronously, in registration order.
   */
  subscribe(handler: (event: CoinDomainEvent) => void): () => void;

  /** Publish a `CoinBalanceChangedEvent`. */
  emitBalanceChanged(event: CoinBalanceChangedEvent): void;

  /** Publish a `CoinTransactionRecordedEvent`. */
  emitTransactionRecorded(event: CoinTransactionRecordedEvent): void;
}

export const COIN_DOMAIN_EVENT_BUS = Symbol('COIN_DOMAIN_EVENT_BUS');
