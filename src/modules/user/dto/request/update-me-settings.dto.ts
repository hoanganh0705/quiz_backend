import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMeSettingsDto {
  @ApiProperty({
    description: 'Arbitrary key-value settings object',
    example: { theme: 'dark', notifications: true, language: 'en' },
    additionalProperties: true,
  })
  @IsObject()
  settings!: Record<string, unknown>;
}