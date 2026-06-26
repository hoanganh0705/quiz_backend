import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyTournamentHistoryItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'Tournament name',
    example: 'Spring Challenge',
  })
  tournamentName!: string;

  @ApiPropertyOptional({
    description: 'Final rank achieved by the authenticated user',
    type: Number,
    nullable: true,
    example: 12,
  })
  rank!: number | null;

  @ApiProperty({
    description: 'Final score achieved by the authenticated user',
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

export class MyTournamentHistoryPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description:
      'Cursor for the next page (base64-encoded { completedAt, participantId })',
    type: String,
    nullable: true,
    example:
      'eyJjb21wbGV0ZWRBdCI6ICIyMDI2LTA2LTAxVDAwOjAwOjAwWiIsICJwYXJ0aWNpcGFudElkIjogIjY2MGU4NDgwLWUyOWItMzFkNC1hNzE2LTQ0NjY1NjU0NDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class MyTournamentHistoryResponseDto {
  @ApiProperty({ type: () => [MyTournamentHistoryItemDto] })
  items!: MyTournamentHistoryItemDto[];

  @ApiProperty({ type: () => MyTournamentHistoryPaginationDto })
  pagination!: MyTournamentHistoryPaginationDto;
}