/**
 * Phase 7 #1 — request DTO for `POST /api/v1/uploads/sign`.
 *
 * Returns a Cloudinary signed-upload envelope so the client can POST
 * the file directly to Cloudinary without streaming it through this
 * application server. See `SignedUploadResponseDto` for the response
 * shape.
 */

import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UPLOAD_PURPOSES } from './upload-file.request.dto';

export class SignUploadRequestDto {
  @ApiProperty({
    description: 'Logical purpose for the upload — server validates against policy.',
    enum: UPLOAD_PURPOSES,
    example: 'avatar',
  })
  @IsString()
  @IsIn(UPLOAD_PURPOSES, { message: 'purpose must be one of: avatar, quiz' })
  purpose!: (typeof UPLOAD_PURPOSES)[number];

  @ApiProperty({
    description:
      'How long (seconds) the signed URL should remain valid. Clamped to [60, 3600] by the storage adapter. Defaults to 600.',
    example: 600,
    minimum: 60,
    maximum: 3600,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresInSeconds?: number;
}
