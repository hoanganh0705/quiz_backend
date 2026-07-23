import { ApiProperty } from '@nestjs/swagger';

/**
 * Cursor payload for paginated suggestions, ordered by (score DESC, mutualFriends DESC, mutualFollowers DESC, username ASC).
 */
export class SuggestionCursorPayload {
  @ApiProperty({ description: 'Composite score', example: 12000 })
  score!: number;

  @ApiProperty({ description: 'Username for tie-breaking', example: 'anh_dev' })
  username!: string;
}

/**
 * Cursor payload for social feed and user activity, ordered by (occurredAt DESC, activityId DESC).
 */
export class FeedCursorPayload {
  @ApiProperty({ description: 'Activity timestamp', example: '2026-06-09T10:00:00.000Z' })
  occurredAt!: string;

  @ApiProperty({ description: 'Activity UUID', example: '660e8400-e29b-71d4-a716-446655440000' })
  activityId!: string;
}

/**
 * Cursor payload for followers/following, ordered by (followedAt DESC, followId DESC).
 */
export class FollowCursorPayload {
  @ApiProperty({ description: 'Follow timestamp', example: '2026-06-09T10:00:00.000Z' })
  followedAt!: string;

  @ApiProperty({
    description: 'Follow record UUID',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  followId!: string;
}

/**
 * Cursor payload for mutual friends/followers, ordered by (username ASC).
 */
export class MutualCursorPayload {
  @ApiProperty({ description: 'Username for alphabetical ordering', example: 'anh_dev' })
  username!: string;
}
