import type { CoinReason } from '../types/coin.types';

export interface CoinBalanceChangedEvent {
  readonly eventType: 'coin.balance_changed';
  readonly userId: string;
  readonly delta: number;
  readonly reason: CoinReason;
  readonly newBalance: number;
  readonly referenceType:
    | 'attempt'
    | 'daily_challenge'
    | 'streak'
    | 'badge'
    | 'tournament'
    | 'tip'
    | 'flair'
    | 'suppress'
    | 'admin'
    | null;
  /** Opaque ID of the source row (attempt_id, challenge_id, …). */
  readonly referenceId: string | null;
  readonly timestamp: Date;
}

export interface CoinTransactionRecordedEvent {
  readonly eventType: 'coin.transaction_recorded';
  readonly transactionId: string;
  readonly userId: string;
  readonly reason: CoinReason;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly referenceType:
    | 'attempt'
    | 'daily_challenge'
    | 'streak'
    | 'badge'
    | 'tournament'
    | 'tip'
    | 'flair'
    | 'suppress'
    | 'admin'
    | null;
  readonly referenceId: string | null;
  readonly timestamp: Date;
}

/**
 * Union of all events emitted by the coin domain bus.
 */
export type CoinDomainEvent = CoinBalanceChangedEvent | CoinTransactionRecordedEvent;
