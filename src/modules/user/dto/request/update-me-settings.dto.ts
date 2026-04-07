import { IsObject } from 'class-validator';

export class UpdateMeSettingsDto {
  @IsObject()
  settings!: Record<string, unknown>;
}
