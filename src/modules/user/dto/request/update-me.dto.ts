import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimStringToNullIfBlank } from '@/common/utils/text.util';
import {
  STORAGE_PUBLIC_ID_INVALID_MESSAGE,
  STORAGE_PUBLIC_ID_TAIL_PATTERN,
} from '@/common/utils/storage-public-id.util';
import {
  PROFILE_AVATAR_URL_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
} from '../../domain/constants/user.domain-constants';

export class UpdateMeDto {
  /**
   * Three-way semantics: `undefined` = no-op (leave current value),
   * `null` / `""` = clear field. The `trimStringToNullIfBlank` transform
   * collapses `""` → `null` before the validator runs, so both mean "clear".
   */
  @ApiPropertyOptional({
    description:
      'Display name shown in the app. ' +
      'Send `null` or a blank string to clear. ' +
      'Omit the field (or send `undefined`) to leave the current value unchanged.',
    type: String,
    maxLength: PROFILE_DISPLAY_NAME_MAX_LENGTH,
    example: 'Alice',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(PROFILE_DISPLAY_NAME_MAX_LENGTH)
  displayName?: string | null;

  @ApiPropertyOptional({
    description:
      'Short bio shown on the profile. ' +
      'Send `null` or a blank string to clear. ' +
      'Omit the field to leave the current value unchanged.',
    type: String,
    maxLength: PROFILE_BIO_MAX_LENGTH,
    example: 'Quiz enthusiast and trivia lover',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(PROFILE_BIO_MAX_LENGTH)
  bio?: string | null;

  @ApiPropertyOptional({
    description:
      'Avatar image URL. ' +
      'Send `null` or a blank string to clear. ' +
      'Omit the field to leave the current value unchanged. ' +
      'Must be a valid `http://` or `https://` URL.',
    type: String,
    maxLength: PROFILE_AVATAR_URL_MAX_LENGTH,
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(PROFILE_AVATAR_URL_MAX_LENGTH)
  avatarUrl?: string | null;

  /**
   * Phase 4 (Cloudinary migration): the Cloudinary `public_id` for the
   * avatar. Phase 6 wires this into the application service; until
   * then the value is accepted by the DTO and the shape is enforced
   * here so the wire contract is locked in.
   *
   * Ownership is enforced server-side by the §11 rule — a malformed
   * value is rejected with 400 ASSET_PUBLIC_ID_INVALID.
   */
  @ApiPropertyOptional({
    description:
      'Cloudinary public_id returned by `POST /api/v1/uploads`. ' +
      'Send `null` to clear. ' +
      "Ownership is verified against the caller's storage_assets row.",
    type: String,
    example:
      'quiz-app/avatars/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @Matches(STORAGE_PUBLIC_ID_TAIL_PATTERN, {
    message: STORAGE_PUBLIC_ID_INVALID_MESSAGE,
  })
  avatarPublicId?: string | null;
}
