import { ApiProperty } from '@nestjs/swagger';

export class SignUploadResponseDto {
  @ApiProperty({
    description: 'Signed endpoint the client should upload the file to.',
    example: 'https://images.example.com/quiz-app/avatars/upload',
  })
  uploadUrl!: string;

  @ApiProperty({
    description:
      'Opaque `public_id` allocated server-side. The client echoes this back when patching the entity.',
    example:
      'quiz-app/avatars/019f5e13-1fca-798f-93cc-b5ef8699de25/019f5e4c-b6fa-72cd-a5a5-ffe59539701d',
  })
  publicId!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp at which the signature will no longer be accepted.',
    example: '2026-07-14T01:33:45.000Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description: 'Access key identifier for signed uploads.',
    example: '123456789012345',
  })
  apiKey!: string;

  @ApiProperty({
    description:
      'Signature the client must include in the request, paired with `timestamp` and `public_id`.',
    example: 'b9f0a3b9aa0b39de9d2de0a4f29f1c81a1f8b3b1',
  })
  signature!: string;

  @ApiProperty({
    description: 'Unix timestamp (seconds) the client must include alongside `signature`.',
    example: 1720916525,
  })
  timestamp!: number;

  @ApiProperty({
    description: 'Storage folder the upload will land in.',
    example: 'quiz-app/avatars',
  })
  folder!: string;
}
