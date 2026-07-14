import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaxKeys, MaxKeyStringLength } from '@/common/validators';

/**
 * Bounded settings payload. Values are unconstrained (any JSON primitive
 * or nested object is accepted) so the settings schema stays flexible for
 * clients.  Only the shape of the top-level object is bounded:
 *
 *   - max 50 top-level keys
 *   - each key string capped at 200 characters
 *
 * Individual value constraints (e.g. max string length for string values,
 * max nesting depth) can be added later if abuse patterns emerge.
 */
export class UpdateMeSettingsDto {
  @ApiProperty({
    description:
      'Arbitrary key-value settings object. ' +
      'Keys are strings; values can be any JSON primitive or object. ' +
      'Maximum 50 top-level keys; each key string is capped at 200 characters.',
    example: { theme: 'dark', notifications: true, language: 'en' },
    additionalProperties: true,
    maxProperties: 50,
  })
  @IsObject()
  @MaxKeys(50)
  @MaxKeyStringLength(200)
  settings!: Record<string, unknown>;
}
