/**
 * Response DTO for `POST /api/v1/uploads/:publicId/bind`.
 *
 * Confirms the (publicId, ownerId, purpose) row was persisted. The
 * client treats this as the signal that it is safe to reference the
 * `publicId` from a subsequent entity write (e.g. avatar patch).
 */

import { ApiProperty } from '@nestjs/swagger';

import { UPLOAD_PURPOSES, type UploadPurposeLiteral } from '../request/upload-file.request.dto';

export class BindUploadResponseDto {
  @ApiProperty({
    description: 'The publicId that was bound to the authenticated user.',
    example:
      'quiz-app/avatars/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a',
  })
  publicId!: string;

  @ApiProperty({
    description: 'Always `true` on success — the bind row was persisted.',
    example: true,
  })
  bound!: true;

  @ApiProperty({
    description: 'The purpose the asset was bound under.',
    enum: UPLOAD_PURPOSES,
  })
  purpose!: UploadPurposeLiteral;

  @ApiProperty({
    description: 'The UUID of the authenticated user who owns the asset now.',
    example: '0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b',
  })
  ownerId!: string;
}
