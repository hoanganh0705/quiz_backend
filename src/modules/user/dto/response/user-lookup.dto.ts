import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserLookupResponseDto {
  @ApiProperty({
    description: 'Opaque user identifier (UUIDv7)',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'URL-friendly handle — the same value the route received',
    example: 'alice_wonder',
  })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    example: 'Alice',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description:
      'True when the user has the `isVerified` flag set (verified creators). ' +
      'Let the client render a verified badge without needing a second round-trip.',
    example: true,
  })
  isVerified!: boolean;
}
