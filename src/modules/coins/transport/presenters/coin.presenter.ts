import { Injectable } from '@nestjs/common';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import { ApiResponse } from '@/common/responses/api-response';
import type { CoinSpendResponseDto } from '../../dto/response/coin-spend-response.dto';
import type { CoinTransactionsResponseDto } from '../../dto/response/coin-transactions.dto';
import type { CoinWalletResponseDto } from '../../dto/response/coin-wallet.dto';

const okEnvelope = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

const paginatedEnvelope = <T>(payload: {
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

@Injectable()
export class CoinPresenter {
  readonly getMyWallet = (
    payload: CoinWalletResponseDto,
  ): ApiResponseEnvelope<CoinWalletResponseDto> => okEnvelope(payload);

  readonly getMyCoinTransactions = (
    payload: CoinTransactionsResponseDto,
  ): ApiResponseEnvelope<CoinTransactionsResponseDto['items'][number]> =>
    paginatedEnvelope(payload);

  readonly spendResult = (
    payload: CoinSpendResponseDto,
  ): ApiResponseEnvelope<CoinSpendResponseDto> => okEnvelope(payload);
}
