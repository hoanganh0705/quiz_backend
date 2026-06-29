import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserActivityItemDto {
  @ApiProperty({
    description: 'Activity event identifier',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  eventId!: string;

  @ApiProperty({
    description: 'Activity event type',
    enum: [
      'attempt_completed',
      'achievement_awarded',
      'tournament_joined',
      'tournament_completed',
      'tournament_won',
      'rank_improved',
      'rank_milestone',
      'streak_milestone',
    ],
    example: 'attempt_completed',
  })
  eventType!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the activity event was created',
    example: '2026-06-25T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Event-specific metadata payload',
    type: 'object',
    additionalProperties: true,
    example: { quizId: '660e8400-e29b-41d4-a716-446655440000', score: 88 },
  })
  metadata!: Record<string, unknown>;
}

export class UserActivityPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page (base64-encoded)',
    type: String,
    nullable: true,
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiIsImV2ZW50SWQiOiJ1dWlkIn0',
  })
  nextCursor!: string | null;
}

export class UserActivityResponseDto {
  @ApiProperty({
    description: 'Activity items for the current page',
    type: () => [UserActivityItemDto],
  })
  items!: UserActivityItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UserActivityPaginationDto })
  pagination!: UserActivityPaginationDto;
}
