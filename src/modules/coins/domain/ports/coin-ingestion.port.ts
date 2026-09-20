import type { CoinReason } from '../types/coin.types';

export interface CoinEventInput {
  userId: string;
  source: 'attempt' | 'daily' | 'streak' | 'badge' | 'tournament';
  amount: number;
  reason: CoinReason;
  referenceId: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  applyDailyCap?: boolean;
}

export interface CoinIngestionPort {
  processCoinEvent(
    event: CoinEventInput,
    now?: Date,
  ): Promise<{
    userId: string;
    appliedDelta: number;
    newBalance: number;
  }>;
}

export const COIN_INGESTION_PORT = Symbol('COIN_INGESTION_PORT');
