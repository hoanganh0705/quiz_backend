import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserSummaryResponseDto } from './user-summary.dto';
import { UserAnalyticsResponseDto } from './user-analytics.dto';
import { TimeSeriesDto } from './time-series.dto';
import { UserActivityItemDto } from './user-activity.dto';
import { CoinWalletResponseDto } from '@/modules/coins/dto/response/coin-wallet.dto';
import {
  CoinTransactionDto,
  CoinTransactionsPaginationDto,
} from '@/modules/coins/dto/response/coin-transactions.dto';

export class UserProfileBundleResponseDto {
  @ApiProperty({
    description: 'User summary (identity + level + counts)',
    type: () => UserSummaryResponseDto,
  })
  summary!: UserSummaryResponseDto;

  @ApiProperty({
    description: 'User analytics (XP, streaks, completion stats)',
    type: () => UserAnalyticsResponseDto,
  })
  analytics!: UserAnalyticsResponseDto;

  @ApiProperty({
    description: 'XP time-series (last 30 days, daily)',
    type: () => TimeSeriesDto,
  })
  xpHistory!: TimeSeriesDto;

  @ApiProperty({
    description: 'Recent activity events (newest first)',
    type: () => [UserActivityItemDto],
  })
  recentActivity!: UserActivityItemDto[];

  @ApiPropertyOptional({
    description:
      "Coin wallet snapshot. Present only on the `/me` variant (privacy: another user's balance is not exposed).",
    type: () => CoinWalletResponseDto,
    nullable: true,
  })
  wallet!: CoinWalletResponseDto | null;

  @ApiPropertyOptional({
    description:
      "First page of the caller's coin ledger (newest first). Capped at 20 items; the wallet page calls `GET /me/coin-transactions` for older entries.",
    type: () => CoinTransactionsPaginationDto,
    nullable: true,
  })
  transactions!: { items: CoinTransactionDto[]; pagination: CoinTransactionsPaginationDto } | null;
}
