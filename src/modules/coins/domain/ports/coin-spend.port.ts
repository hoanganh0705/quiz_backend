import type { CoinReason } from '../types/coin.types';

export type CoinSpendCategory = 'tip' | 'flair' | 'suppress' | 'admin';

export interface CoinSpendInput {
  userId: string;
  category: CoinSpendCategory;
  reason: CoinReason;
  amount: number;
  referenceId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CoinSpendResult {
  userId: string;
  appliedDelta: number;
  newBalance: number;
  transactionId: string;
}

export interface CoinSpendPort {
  processSpend(input: CoinSpendInput, now?: Date): Promise<CoinSpendResult>;
}

export const COIN_SPEND_PORT = Symbol('COIN_SPEND_PORT');
