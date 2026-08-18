/**
 * Response DTO for `POST /api/v1/uploads`.
 *
 * Mirrors the `UploadResult` shape from `core/storage/storage.types.ts`
 * (so the controller does not have to know the storage layer's
 * internal field names). The frontend treats `publicId` as opaque and
 * echoes it back when patching the entity.
 */

import { ApiProperty } from '@nestjs/swagger';
import { UPLOAD_PURPOSES, type UploadPurposeLiteral } from '../request/upload-file.request.dto';

export class UploadFileResponseDto {
  @ApiProperty({
    description:
      'Server-generated Cloudinary public_id. ' +
      'Treat as opaque; echo back unchanged when patching the entity.',
    example:
      'quiz-app/avatars/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a',
  })
  publicId!: string;

  @ApiProperty({
    description: 'A pre-derived render URL the client may use for immediate preview.',
    example: 'https://res.cloudinary.com/demo/image/upload/w_512,h_512,c_fill/...',
    format: 'uri',
  })
  url!: string;

  @ApiProperty({
    description: 'Bytes stored (as reported by the storage provider).',
    example: 184320,
  })
  bytes!: number;

  @ApiProperty({ description: 'Reported image format.', example: 'webp' })
  format!: string;

  @ApiProperty({ description: 'Reported width in pixels.', example: 1024 })
  width!: number;

  @ApiProperty({ description: 'Reported height in pixels.', example: 1024 })
  height!: number;

  @ApiProperty({ description: 'The purpose that was bound to this asset.', enum: UPLOAD_PURPOSES })
  purpose!: UploadPurposeLiteral;
}
