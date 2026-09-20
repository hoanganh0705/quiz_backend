import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartCountdownDto {
  @ApiPropertyOptional({
    description:
      'Optional client-supplied idempotency key. A retry of the same key within the ' +
      '`idempotency_keys` TTL returns the original response instead of re-arming the countdown. ' +
      'Maximum length 255 characters.',
    maxLength: 255,
    example: 'countdown-start-7d8e4f5a-9b1c-4f2e-9b1a-1f2e3d4c5b6a',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
