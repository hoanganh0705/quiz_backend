import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cursor-based pagination for user followers/following.
 */
export class UserFollowCursorPaginationDto {
  @ApiProperty({
    description: 'Discriminator field. Always "cursor" for cursor pagination.',
    example: 'cursor',
  })
  readonly kind = 'cursor' as const;

  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiProperty({
    description:
      'Opaque cursor string for fetching the next page. `null` when there is no next page.',
    example:
      'eyJmb2xsb3dlZEF0IjoiMjAyNS0wNS0yMFQwOTowMDowMC4wMDBaIiwiZm9sbG93SWQiOiI1NTBlODQwMC1lMjliLTcxZDQtYTcxNi00NDY2NTU0NDAwMDAwIn0=',
    nullable: true,
  })
  nextCursor!: string | null;
}

/**
 * Offset-based pagination for user followers/following (legacy, use cursor-based).
 */
export class UserFollowersPaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Number of items requested per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of followers', example: 120 })
  total!: number;
}

/**
 * User follower list item (public DTO).
 * Note: followId is intentionally excluded as it's an internal database ID.
 */
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

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowCursorPaginationDto })
  pagination!: UserFollowCursorPaginationDto;
}

/**
 * User following list item (public DTO).
 * Note: followId is intentionally excluded as it's an internal database ID.
 */
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

  @ApiProperty({ description: 'Pagination metadata', type: () => UserFollowCursorPaginationDto })
  pagination!: UserFollowCursorPaginationDto;
}
