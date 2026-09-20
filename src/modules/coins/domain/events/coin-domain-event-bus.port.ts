import type {
  CoinBalanceChangedEvent,
  CoinTransactionRecordedEvent,
  CoinDomainEvent,
} from './coin-domain.events';

export interface CoinDomainEventBusPort {
  subscribe(handler: (event: CoinDomainEvent) => void): () => void;
  emitBalanceChanged(event: CoinBalanceChangedEvent): void;
  emitTransactionRecorded(event: CoinTransactionRecordedEvent): void;
}

export const COIN_DOMAIN_EVENT_BUS = Symbol('COIN_DOMAIN_EVENT_BUS');
