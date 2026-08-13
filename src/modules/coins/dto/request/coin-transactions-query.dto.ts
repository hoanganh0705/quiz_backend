import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query string for `GET /me/coin-transactions`.
 *
 * Cursor shape: base64url-encoded JSON of
 *   `{ createdAt: ISO8601, transactionId: UUIDv7 }`
 *
 * Opaque to the client — the server decodes it back into the keyset
 * pair for the SQL `WHERE` predicate on `coin_transactions`.
 */
export class CoinTransactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page (omit on first request)',
    type: String,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum entries per page (1–50)',
    type: Number,
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
