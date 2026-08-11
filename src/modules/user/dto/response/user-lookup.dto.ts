import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 1 (S-1): read-only public projection of a user keyed by username.
 *
 * Returned by `GET /users/by-username/:username`. The route exists to
 * resolve a URL-friendly handle (which is what the frontend profile
 * route uses: `/profile/[name]`) into the opaque `userId` every other
 * user-scoped endpoint already expects. Five fields is intentional —
 * the lookup is the smallest payload that lets the client decide
 * "is this the user I want to render?". Author/embedding data lives
 * on `/users/:userId` once the client has the id.
 */
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
