import { Type } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsShallowPreferencesBlob, MaxKeys, MaxKeyStringLength } from '@/common/validators';

/**
 * Privacy flags that drive cross-user visibility (`F-7`). Mirrors the
 * columns of `user_profile_settings` 1:1. Every flag defaults to `true`
 * (visible) at the DB layer; clients can flip any flag to `false` to
 * hide the corresponding section from other users.
 */
export class UserPrivacySettingsDto {
  @ApiPropertyOptional({
    description:
      'Master visibility toggle. When `false`, every cross-user read ' +
      'returns 403 (privacy-gated). Self reads always succeed.',
    type: Boolean,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Show aggregated statistics (XP, level, ranking, analytics) to other users.',
    type: Boolean,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  showStatistics?: boolean;

  @ApiPropertyOptional({
    description: 'Show earned badges to other users.',
    type: Boolean,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  showAchievements?: boolean;

  @ApiPropertyOptional({
    description:
      'Show recent activity events to other users (also governs ' +
      '`GET /social/users/:userId/activity`, see F-13).',
    type: Boolean,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  showActivity?: boolean;

  @ApiPropertyOptional({
    description: 'Show rank-improvement notifications to other users.',
    type: Boolean,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  showRankImprovement?: boolean;

  @ApiPropertyOptional({
    description:
      'Show tournament participation / history / public tournament profile ' + 'to other users.',
    type: Boolean,
    example: true,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  showTournamentActivity?: boolean;
}

/**
 * Bounded settings payload. Two optional sub-objects:
 *
 *   - `privacy`     — writes to `user_profile_settings` (privacy flags).
 *   - `preferences` — writes to `users.settings` (free-form JSONB blob).
 *
 * Both sub-objects are optional; at least one must be present. Each
 * field is keyed three-way:
 *   - absent  → no-op (the stored value is left alone)
 *   - `null`  → treat as absent (the `class-transformer` pipeline may
 *               render absent fields as `null`; the validator sees `null`
 *               and the application layer strips it)
 *   - present → store the supplied value
 *
 * `preferences` is bounded identically to the previous whole-object
 * replace shape (≤50 top-level keys, ≤200-char key strings).
 *
 * See `docs/audits/USER_MODULE_PRODUCTION_READINESS_AUDIT.md` (F-6)
 * for the design rationale.
 */
export class UpdateMeSettingsDto {
  @ApiPropertyOptional({
    description:
      'Free-form preferences JSON object, persisted to `users.settings`. ' +
      'Bounded: ≤50 top-level keys, ≤200-char key strings, nested objects ' +
      'capped at depth 3, string values capped at 1000 characters, no binary blobs. ' +
      'Omit to leave the current preferences unchanged.',
    example: { theme: 'dark', notifications: true, language: 'en' },
    additionalProperties: true,
    maxProperties: 50,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  @MaxKeys(50)
  @MaxKeyStringLength(200)
  @IsShallowPreferencesBlob()
  preferences?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Privacy flags, persisted to `user_profile_settings`. ' +
      'Each flag omitted leaves the stored value unchanged.',
    type: UserPrivacySettingsDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPrivacySettingsDto)
  privacy?: UserPrivacySettingsDto;
}
