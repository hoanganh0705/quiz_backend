/**
 * Request DTO for `POST /api/v1/uploads/:publicId/bind`.
 *
 * Used after a client has uploaded a file directly to Cloudinary
 * using a presigned envelope from `POST /api/v1/uploads/sign`. The
 * client echoes the resulting `publicId` here so the server can
 * persist the ownership row in `storage_assets`.
 *
 * Body is JSON — the route has no `FileInterceptor`. Validation runs
 * through the same `UPLOAD_PURPOSES` allowlist as `UploadFileRequestDto`
 * so the wire surface stays uniform.
 */

import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { UPLOAD_PURPOSES, type UploadPurposeLiteral } from './upload-file.request.dto';

export class BindUploadRequestDto {
  @ApiProperty({
    description: 'Logical purpose this asset will be bound under.',
    enum: UPLOAD_PURPOSES,
    example: 'avatar',
  })
  @IsString()
  @IsIn(UPLOAD_PURPOSES, { message: 'purpose must be one of: avatar, quiz' })
  purpose!: UploadPurposeLiteral;
}
