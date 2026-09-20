import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';

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

  @ApiProperty({
    description: 'Discriminator for the suggestion reason.',
    enum: SOCIAL_SUGGESTION_REASON_VALUES,
    example: 'mutual_friends',
  })
  reason!: SocialSuggestionReason;

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
