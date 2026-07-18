import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserFollowersPaginationDto } from './paginated.dto';

export class MutualFriendItemDto {
  @ApiProperty({
    description: 'Mutual friend user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Mutual friend username', example: 'mike_ross' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Mutual friend avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/mike.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class MutualFriendsResponseDto {
  @ApiProperty({ description: 'Mutual friend items', type: () => [MutualFriendItemDto] })
  items!: MutualFriendItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class MutualFollowerItemDto {
  @ApiProperty({
    description: 'Mutual follower user identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Mutual follower username', example: 'user_b' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Mutual follower avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/user-b.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class MutualFollowersResponseDto {
  @ApiProperty({ description: 'Mutual follower items', type: () => [MutualFollowerItemDto] })
  items!: MutualFollowerItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}
