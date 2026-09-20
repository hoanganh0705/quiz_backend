import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PublicTournamentHistoryItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'Tournament name',
    example: 'Spring Challenge',
  })
  tournamentName!: string;

  @ApiPropertyOptional({
    description:
      'Final rank achieved by the target user in this tournament. ' +
      "Visible to anyone who can read the user's tournament history " +
      '(i.e. the target user has `showTournamentActivity: true` per ' +
      '.',
    type: Number,
    nullable: true,
    example: 12,
  })
  rank!: number | null;

  @ApiProperty({
    description: 'Final score achieved by the target user in this tournament',
    example: 540,
  })
  score!: number;

  @ApiProperty({
    description: 'Number of participants who finished the tournament',
    example: 523,
  })
  participantCount!: number;

  @ApiProperty({
    description: 'Timestamp when the tournament was completed',
    example: '2026-06-01T00:00:00.000Z',
  })
  completedAt!: string;
}

export class PublicTournamentHistoryPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Cursor for the next page (base64-encoded { completedAt, participantId })',
    type: String,
    nullable: true,
    example:
      'eyJjb21wbGV0ZWRBdCI6ICIyMDI2LTA2LTAxVDAwOjAwOjAwWiIsICJwYXJ0aWNpcGFudElkIjogIjY2MGU4NDgwLWUyOWItMzFkNC1hNzE2LTQ0NjY1NjU0NDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class PublicTournamentHistoryResponseDto {
  @ApiProperty({
    description:
      'Public tournament history for the target user, newest first. ' +
      "Honours the target user's `showTournamentActivity` privacy flag " +
      'replaced with HTTP 403 — a successful 200 always means the caller ' +
      'is the owner OR the target user has explicitly opted in to share.',
    type: () => [PublicTournamentHistoryItemDto],
  })
  items!: PublicTournamentHistoryItemDto[];

  @ApiProperty({
    description: 'Cursor pagination metadata',
    type: () => PublicTournamentHistoryPaginationDto,
  })
  pagination!: PublicTournamentHistoryPaginationDto;
}
