import { ApiProperty } from '@nestjs/swagger';

/**
 * Phase 3 (S-15): one row in the live-winners carousel. The
 * `timeAgo` field is a pre-computed, server-rendered relative
 * timestamp ("3 minutes ago") so the frontend does not need a
 * second render after mount — the wire shape is final.
 */
export class WinnerSummaryDto {
  @ApiProperty({
    description: 'User identifier of the winner',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Winner username', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({
    description: 'Winner display name',
    example: 'Alice',
    nullable: true,
  })
  displayName!: string | null;

  @ApiProperty({
    description: 'Winner avatar URL',
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Tournament title the user won',
    example: 'Spring Open 2026',
  })
  quizTitle!: string;

  @ApiProperty({
    description: "Reward amount (XP equivalent). The frontend renders '$' prefix.",
    example: '15.00',
  })
  amountWon!: string;

  @ApiProperty({
    description: 'Server-rendered relative timestamp',
    example: '3 minutes ago',
  })
  timeAgo!: string;

  @ApiProperty({
    description: 'Raw timestamp the row was recorded (ISO 8601)',
    example: '2026-08-10T12:34:56.000Z',
  })
  wonAt!: string;
}

export class RecentWinnersResponseDto {
  @ApiProperty({
    description: 'Live winners list, newest first',
    type: () => [WinnerSummaryDto],
  })
  winners!: WinnerSummaryDto[];

  @ApiProperty({
    description: 'Timestamp of the last update (ISO 8601)',
    example: '2026-08-10T13:00:00.000Z',
  })
  lastUpdated!: string;
}
