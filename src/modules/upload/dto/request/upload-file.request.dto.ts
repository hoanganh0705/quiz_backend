/**
 * Request DTO for `POST /api/v1/uploads`.
 *
 * The multipart file is extracted by `FileInterceptor('file')` on the
 * controller; this DTO only carries the metadata fields. The body is
 * JSON-encoded (Multer's default for non-file fields); `class-validator`
 * rejects anything outside the allowlist.
 */

import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The upload purposes that the API exposes. Kept in this module-local
 * file (rather than re-exported from `core/storage`) so the wire
 * contract is owned by the upload module — adding a new purpose later
 * is a one-line change here.
 */
export const UPLOAD_PURPOSES = ['avatar', 'quiz'] as const;
export type UploadPurposeLiteral = (typeof UPLOAD_PURPOSES)[number];

export class UploadFileRequestDto {
  @ApiProperty({
    description: 'Logical purpose for this upload',
    enum: UPLOAD_PURPOSES,
    example: 'avatar',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  @IsIn(UPLOAD_PURPOSES, { message: 'purpose must be one of: avatar, quiz' })
  purpose!: UploadPurposeLiteral;
}
