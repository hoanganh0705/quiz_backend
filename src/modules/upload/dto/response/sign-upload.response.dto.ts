/**
 * Phase 7 #1 — response for `POST /api/v1/uploads/sign`.
 *
 * The client POSTs the file directly to `uploadUrl` as a multipart
 * form with the fields enumerated below. `publicId` is the value the
 * client should later echo back when patching the entity (e.g. when
 * updating `user.avatarPublicId`).
 */

import { ApiProperty } from '@nestjs/swagger';

export class SignUploadResponseDto {
  @ApiProperty({
    description: 'Cloudinary endpoint the client should POST the file to.',
    example: 'https://api.cloudinary.com/v1_1/my-cloud/image/upload',
  })
  uploadUrl!: string;

  @ApiProperty({
    description:
      'Opaque `public_id` allocated server-side. The client echoes this back when patching the entity.',
    example: 'quiz-app/avatars/019f5e13-1fca-798f-93cc-b5ef8699de25/019f5e4c-b6fa-72cd-a5a5-ffe59539701d',
  })
  publicId!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp at which the signature will no longer be accepted.',
    example: '2026-07-14T01:33:45.000Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description: 'Cloudinary `api_key` the client must include alongside the upload.',
    example: '123456789012345',
  })
  apiKey!: string;

  @ApiProperty({
    description:
      'Hex-encoded SHA-1 signature the client must include in the form data, paired with `timestamp` and `public_id`.',
    example: 'b9f0a3b9aa0b39de9d2de0a4f29f1c81a1f8b3b1',
  })
  signature!: string;

  @ApiProperty({
    description: 'Unix timestamp (seconds) the client must include alongside `signature`.',
    example: 1720916525,
  })
  timestamp!: number;

  @ApiProperty({
    description: 'Cloudinary folder the upload will land in.',
    example: 'quiz-app/avatars',
  })
  folder!: string;
}
