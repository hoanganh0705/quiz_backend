import type { CoinTx } from './coin-repository.port';

export type { CoinTx };

export interface CoinOutboxPort {
  scheduleCoinEvent(
    params: {
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      idempotencyKey?: string;
    },
    tx: CoinTx,
  ): Promise<void>;
}

export const COIN_OUTBOX_PORT = Symbol('COIN_OUTBOX_PORT');
