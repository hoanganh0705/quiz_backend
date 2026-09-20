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
