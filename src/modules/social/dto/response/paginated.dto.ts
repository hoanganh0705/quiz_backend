import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserFollowersPaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Number of items requested per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of followers', example: 120 })
  total!: number;
}

export class UserFollowerItemDto {
  @ApiProperty({
    description: "The follower's user identifier",
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: "The follower's username", example: 'charlie_chap' })
  username!: string;

  @ApiPropertyOptional({
    description: "The follower's avatar URL",
    format: 'uri',
    example: 'https://example.com/avatars/charlie.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the follow occurred (ISO 8601)',
    example: '2025-05-20T09:00:00.000Z',
  })
  followedAt!: string;
}

export class UserFollowersResponseDto {
  @ApiProperty({ description: 'Follower items', type: () => [UserFollowerItemDto] })
  items!: UserFollowerItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}

export class UserFollowingItemDto {
  @ApiProperty({
    description: 'User identifier of the person being followed',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username of the person being followed', example: 'diana_prince' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Avatar URL of the person being followed',
    format: 'uri',
    example: 'https://example.com/avatars/diana.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Timestamp when the follow occurred (ISO 8601)',
    example: '2025-05-20T09:00:00.000Z',
  })
  followedAt!: string;
}

export class UserFollowingResponseDto {
  @ApiProperty({ description: 'Following items', type: () => [UserFollowingItemDto] })
  items!: UserFollowingItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowersPaginationDto })
  pagination!: UserFollowersPaginationDto;
}
