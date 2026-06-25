import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserFollowersPaginationDto } from './paginated.dto';

export class SocialSuggestionItemDto {
  @ApiProperty({
    description: 'Suggested user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Suggested username', example: 'anh_dev' })
  username!: string;

  @ApiPropertyOptional({
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
    description: 'Human-readable primary suggestion reason',
    example: '12 mutual friends',
  })
  reason!: string;
}

export class SocialSuggestionsResponseDto {
  @ApiProperty({ description: 'Suggested users', type: () => [SocialSuggestionItemDto] })
  items!: SocialSuggestionItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}
