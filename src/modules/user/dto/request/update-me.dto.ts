import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimStringToNullIfBlank } from '@/common/utils/text.util';
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
}
