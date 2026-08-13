import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `GET /me/coin-transactions` page — newest-first ledger entries.
 *
 * `amount` is signed (positive for earnings, negative for spends). The
 * `balanceAfter` field is the wallet balance *after* this row was
 * applied, so a UI can render the running balance without
 * re-aggregating.
 */
export class CoinTransactionDto {
  @ApiProperty({
    description: 'Opaque ledger row identifier (UUIDv7)',
    example: '01938d7c-9d11-71d4-a716-446655440000',
  })
  transactionId!: string;

  @ApiProperty({
    description:
      'Coin delta. Positive for earnings (reward, badge, streak, daily), negative for spends (tip, flair, suppress, admin clawback).',
    example: 5,
  })
  amount!: number;

  @ApiProperty({
    description: 'Wallet balance after this row was applied',
    example: 487,
  })
  balanceAfter!: number;

  @ApiProperty({
    description: 'Stable enum discriminator. The `coin_reason` PostgreSQL enum in §9.2.',
    example: 'QUIZ_COMPLETION_REWARD',
  })
  reason!: string;

  @ApiPropertyOptional({
    description:
      'Coarse reference discriminator — the table or domain object the transaction originated from.',
    type: String,
    example: 'attempt',
    nullable: true,
  })
  referenceType!: string | null;

  @ApiPropertyOptional({
    description: 'Opaque source-row ID (attempt_id, challenge_id, badge_id, tournament_id, …).',
    type: String,
    example: '01938d7c-9d11-71d4-a716-446655440000',
    nullable: true,
  })
  referenceId!: string | null;

  @ApiPropertyOptional({
    description:
      'Free-form metadata. The shape depends on `reason`: for `BADGE_REWARD` it carries `{ badgeType, awardedAt }`, for `STREAK_MILESTONE_REWARD` it carries `{ previousStreak, currentStreak, longestStreak, isNewRecord }`, etc.',
    type: 'object',
    additionalProperties: true,
    example: { badgeType: 'top100', awardedAt: '2026-08-11T13:30:41.000Z' },
  })
  metadata!: Record<string, unknown>;

  @ApiProperty({
    description: 'Ledger row creation timestamp (ISO 8601)',
    example: '2026-08-11T13:30:41.000Z',
  })
  createdAt!: string;
}

export class CoinTransactionsPaginationDto {
  @ApiProperty({
    description: 'Cursor discriminator (always "cursor")',
    example: 'cursor',
  })
  kind!: 'cursor';

  @ApiProperty({ description: 'Page size requested', example: 20 })
  limit!: number;

  @ApiProperty({
    description: 'Whether another page is available after this one',
    example: true,
  })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page. Null when `hasNextPage === false`.',
    type: String,
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA4LTExVDEzOjMwOjQxLjAwMFoiLCJ0cmFuc2FjdGlvbklkIjoiMDE5MzhkN2MtOWQxMS03MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=',
  })
  nextCursor!: string | null;
}

export class CoinTransactionsResponseDto {
  @ApiProperty({
    description: 'Page of ledger entries (newest first)',
    type: [CoinTransactionDto],
  })
  items!: CoinTransactionDto[];

  @ApiProperty({
    description: 'Cursor pagination envelope',
    type: () => CoinTransactionsPaginationDto,
  })
  pagination!: CoinTransactionsPaginationDto;
}
