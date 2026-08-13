/**
 * `POST /coins/suppress-recommended` request body.
 *
 * Phase 6 / S-coin-spend. Caller hides a quiz from their Recommended
 * rail for 30 days. The server enforces the "no double-buy while a
 * previous window is active" rule with
 * `COIN_SUPPRESS_ALREADY_ACTIVE`.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CoinSuppressRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "Quiz to hide from the caller's Recommended rail for 30 days. Returns 404 if the quiz does not exist.",
  })
  @IsUUID()
  quizId!: string;
}
