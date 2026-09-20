import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class CoinAdminAdjustRequestDto {
  @ApiProperty({ format: 'uuid', description: 'User whose balance is being adjusted.' })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description:
      'Signed coin amount. Positive = grant, negative = clawback. Bounded to ±1_000_000 (mirrors user_wallets.balance cap).',
    minimum: -1_000_000,
    maximum: 1_000_000,
  })
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  amount!: number;

  @ApiProperty({
    description:
      'REQUIRED: human-readable justification. Persisted to ledger.metadata.reason. Surfaces in the admin audit UI.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiProperty({
    format: 'uuid',
    required: false,
    description:
      'Caller-supplied idempotency key. Defaults to a UUIDv7 minted by the service if omitted. Re-submitting the same key returns the same ledger row.',
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
