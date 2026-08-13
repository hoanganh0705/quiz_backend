/**
 * `POST /coins/flair` request body.
 *
 * Phase 6 / S-coin-spend. Caller pins one of their owned badges to
 * their profile for 7 days. The `userBadgeId` must point to a row in
 * `user_badges` that the caller owns (and is not revoked).
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CoinFlairRequestDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The userBadgeId to pin. Must be owned by the caller and not revoked (server checks via COIN_FLAIR_BADGE_NOT_OWNED).',
  })
  @IsUUID()
  userBadgeId!: string;
}
