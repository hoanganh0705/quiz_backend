import { Injectable } from '@nestjs/common';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import { ApiResponse } from '@/common/responses/api-response';
import type { CoinSpendResponseDto } from '../../dto/response/coin-spend-response.dto';
import type { CoinTransactionsResponseDto } from '../../dto/response/coin-transactions.dto';
import type { CoinWalletResponseDto } from '../../dto/response/coin-wallet.dto';

/**
 * Coin Presenter
 *
 * Wraps each application-service response in the canonical
 * `{ data, meta: { timestamp } }` envelope. The presenter is the only
 * place that knows about `ApiResponse` — controllers and tests can
 * call the application service directly and inspect the unwrapped DTO.
 *
 * The transactions endpoint uses `wrapPaginated` so the envelope is
 * `{ data: CoinTransactionDto[], meta: { timestamp, pagination } }`,
 * matching the rest of the API.
 */
@Injectable()
export class CoinPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  private static readonly paginated = <T>(payload: {
    items: readonly T[];
    pagination: { kind: 'cursor'; limit: number; hasNextPage: boolean; nextCursor: string | null };
  }): ApiResponseEnvelope<T[]> => ({
    data: [...payload.items] as T[],
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        kind: 'cursor' as const,
        limit: payload.pagination.limit,
        hasNextPage: payload.pagination.hasNextPage,
        nextCursor: payload.pagination.nextCursor,
      },
    },
  });

  /** `GET /me/wallet`. */
  readonly getMyWallet = (payload: CoinWalletResponseDto) =>
    CoinPresenter.ok<CoinWalletResponseDto>(payload);

  /** `GET /me/coin-transactions`. */
  readonly getMyCoinTransactions = (payload: CoinTransactionsResponseDto) =>
    CoinPresenter.paginated<CoinTransactionsResponseDto['items'][number]>(payload);

  /**
   * `POST /coins/{tip,flair,suppress-recommended}` and
   * `POST /admin/coins/adjust` — return the post-spend balance
   * snapshot. Phase 6 (S-coin-spend) addition.
   */
  readonly spendResult = (payload: CoinSpendResponseDto) =>
    CoinPresenter.ok<CoinSpendResponseDto>(payload);
}
