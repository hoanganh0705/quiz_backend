import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `GET /me/wallet` response — the cached wallet state.
 *
 * The wire shape mirrors `user_wallets` plus a denormalised
 * `lastTransactionAt` (NULL when the wallet has never been credited).
 * Frontends render the balance in the header pill and the history
 * page reads the same value as the source of truth.
 */
export class CoinWalletResponseDto {
  @ApiProperty({
    description: "User's current coin balance (cached, hot read)",
    example: 487,
  })
  balance!: number;

  @ApiProperty({
    description: 'Wallet row creation timestamp (ISO 8601)',
    example: '2026-07-01T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last wallet write timestamp (ISO 8601)',
    example: '2026-08-11T13:30:41.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description:
      'Timestamp of the most recent ledger entry for this user (ISO 8601). Null when the wallet has never been credited.',
    type: String,
    example: '2026-08-11T13:30:41.000Z',
    nullable: true,
  })
  lastTransactionAt!: string | null;

  @ApiProperty({
    description:
      'Earned coins today (UTC) from the daily-cap-eligible reasons (QUIZ_COMPLETION_REWARD + QUIZ_PERFECT_BONUS). 0 means the user has not earned any today yet.',
    example: 35,
  })
  earnedToday!: number;

  @ApiProperty({
    description: 'Daily earning cap (200 by product policy).',
    example: 200,
  })
  dailyEarnCap!: number;
}
