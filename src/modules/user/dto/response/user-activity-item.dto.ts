import { ApiProperty } from '@nestjs/swagger';

export class UserActivityItemDto {
  @ApiProperty()
  eventId!: string;

  @ApiProperty({
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
  })
  eventType!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp when the activity event was created' })
  createdAt!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}
