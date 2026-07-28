import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 4 (F-10): Public-facing item shape for
 * `GET /users/:userId/tournament-history`. Distinct from
 * `MyTournamentHistoryItemDto` so the OpenAPI schema can document the
 * privacy-gating semantics that apply when the requester is *not* the
 * target user. Currently the wire shape is identical to the me-endpoint
 * (the target user controls the same fields in both cases) but the
 * privacy description differs and the two DTOs may diverge in the
 * future (e.g. hiding `participantCount` from non-friends).
 */
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
      'Phase 3 / F-7).',
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
      '(Phase 3 / F-7). When the flag is `false`, the entire response is ' +
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
