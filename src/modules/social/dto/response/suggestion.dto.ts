import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';

/**
 * Phase 3 (S-18): the `reason` field is now a closed enum
 * so the SDK emits a literal union the frontend can switch on.
 * The legacy human-readable string (`"12 mutual friends"`)
 * is still surfaced via the optional `reasonLabel` field.
 */
export const SOCIAL_SUGGESTION_REASON_VALUES = [
  'mutual_friends',
  'shared_tags',
  'shared_activity',
  'popular',
] as const;

export type SocialSuggestionReason = (typeof SOCIAL_SUGGESTION_REASON_VALUES)[number];

export class SocialSuggestionItemDto {
  @ApiProperty({
    description: 'Suggested user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Suggested username', example: 'anh_dev' })
  username!: string;

  @ApiProperty({
    description: 'Suggested user avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/anh.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Number of mutual friends', example: 12 })
  mutualFriends!: number;

  @ApiProperty({ description: 'Number of mutual followers', example: 8 })
  mutualFollowers!: number;

  /**
   * Phase 3 (S-18): discriminated reason for the suggestion.
   */
  @ApiProperty({
    description: 'Phase 3 (S-18): discriminator for the suggestion reason.',
    enum: SOCIAL_SUGGESTION_REASON_VALUES,
    example: 'mutual_friends',
  })
  reason!: SocialSuggestionReason;

  /**
   * Phase 3 (S-18): human-readable label for the reason
   * (preserves the legacy wire shape so the existing UI does
   * not need to localise every reason case at this commit).
   */
  @ApiPropertyOptional({
    description: 'Human-readable label, e.g. "12 mutual friends".',
    example: '12 mutual friends',
    nullable: true,
  })
  reasonLabel!: string | null;
}

export class SocialSuggestionsResponseDto {
  @ApiProperty({ description: 'Suggested users', type: () => [SocialSuggestionItemDto] })
  items!: SocialSuggestionItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}
