/**
 * `POST /coins/{tip,flair,suppress-recommended}` and
 * `POST /admin/coins/adjust` response body.
 *
 * Phase 6 / S-coin-spend. Every successful spend returns the
 * post-spend balance snapshot so the client can render the pill
 * without a follow-up `GET /users/me/wallet`. The shape mirrors
 * the earn side: `{ transactionId, balance, createdAt }`.
 */
import { ApiProperty } from '@nestjs/swagger';

export class CoinSpendResponseDto {
  @ApiProperty({
    description: 'Opaque ledger row identifier (UUIDv7) for the new spend row.',
  })
  transactionId!: string;

  @ApiProperty({
    description: "User's wallet balance AFTER this spend committed.",
    example: 462,
  })
  balance!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the ledger row commit.',
  })
  createdAt!: string;

  @ApiProperty({
    description:
      'Signed delta that was applied. Always negative for /coins/* endpoints; signed for /admin/coins/adjust.',
    example: -25,
  })
  amount!: number;
}
