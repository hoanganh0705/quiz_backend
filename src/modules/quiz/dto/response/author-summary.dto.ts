import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 2 (S-6 + S-7): slim creator projection embedded on
 * `QuizListItemDto` and `QuizResponseDto`. Five fields is
 * intentional — listing and detail cards need to render an avatar
 * and a name without a second round-trip to `/users/:userId`.
 *
 * The shape intentionally mirrors `UserLookupResponseDto` minus the
 * `isVerified` flag (the verified badge is rendered on the
 * author profile, not on every quiz card they own — that would be
 * visual noise). When the frontend needs the verified flag it
 * reads it from the dedicated author-profile fetch, not the card.
 */
export class AuthorSummaryDto {
  @ApiProperty({
    description: 'Opaque user identifier (UUIDv7)',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'URL-friendly handle', example: 'nestjs_dev' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    example: 'NestJS Dev',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/nestjs_dev.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}
