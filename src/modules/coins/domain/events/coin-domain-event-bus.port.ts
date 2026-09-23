import type {
  CoinBalanceChangedEvent,
  CoinRefundedEvent,
  CoinTransactionRecordedEvent,
  CoinDomainEvent,
} from './coin-domain.events';

export const COIN_DOMAIN_EVENT_BUS = Symbol('COIN_DOMAIN_EVENT_BUS');

export interface CoinDomainEventBusPort {
  subscribe(handler: (event: CoinDomainEvent) => void): () => void;
  emitBalanceChanged(event: CoinBalanceChangedEvent): void;
  emitTransactionRecorded(event: CoinTransactionRecordedEvent): void;
  emitRefunded(event: CoinRefundedEvent): void;
}
