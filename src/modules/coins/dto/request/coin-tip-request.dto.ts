/**
 * `POST /coins/tip` request body.
 *
 * Phase 6 / S-coin-spend. Caller picks the recipient and the quiz
 * that inspired the tip; the server resolves the rest. The `amount`
 * is an enum because the MVP design locks the tip amount to a single
 * product value (25 coins, see §7). Future expansion: allow an
 * arbitrary amount, but the enum keeps the open-ended-spam attack
 * surface closed today.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum CoinTipAmount {
  STANDARD = 25,
}

export class CoinTipRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Recipient user id (the quiz author).' })
  @IsUUID()
  recipientUserId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Quiz that prompted the tip. Optional in MVP but recommended for the recipient activity feed.',
  })
  @IsOptional()
  @IsUUID()
  quizId?: string;

  @ApiProperty({
    description:
      'Optional short message (≤ 280 chars). Stored in the ledger metadata for the recipient.',
    maxLength: 280,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;

  @ApiProperty({
    enum: CoinTipAmount,
    description:
      'Coin amount to tip. MVP-only enum — the only allowed value today is 25 (COIN_SPEND_AMOUNTS.TIP_QUIZ_AUTHOR).',
    default: CoinTipAmount.STANDARD,
  })
  @IsEnum(CoinTipAmount)
  amount!: CoinTipAmount;
}
