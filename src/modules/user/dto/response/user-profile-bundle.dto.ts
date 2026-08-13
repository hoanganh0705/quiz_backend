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

/**
 * `UserProfileBundleResponseDto` — Phase 4 (S-25) bundle returned
 * by `GET /users/me/profile` and `GET /users/:userId/profile`.
 *
 * The my-profile page used to issue 8+ sequential calls (summary,
 * analytics, xp history, recent activity, social counts, …). The
 * bundle collapses the fan-out into a single round-trip by
 * parallelising the sub-queries. The wire shape is the union of
 * the existing per-endpoint DTOs so the frontend can drop the
 * bundle straight into the existing profile view with no
 * consumer-side projection.
 *
 * ## Stability
 *
 * The endpoint is `Public()` only for `:userId`; the `/me`
 * variant requires auth. The bundle shape is identical for both
 * endpoints so the frontend reuses the same shape under either
 * path. For the public variant, the `summary.displayName`,
 * `summary.bio`, `summary.avatarUrl` and the activity timeline
 * may be omitted per the user's `showActivity` / `showStats`
 * privacy flags.
 */
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

  // ─── Phase 3 (S-coin): coin-economy surfaces ──────────────────────────

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
