import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'Final rank achieved by the authenticated user',
    example: 12,
    nullable: true,
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
    example: '2026-06-01T00:00:00Z',
  })
  completedAt!: string;
}

export class MyTournamentHistoryPaginationDto {
  @ApiProperty({ description: 'Total number of matching completed tournaments', example: 12 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}

export class MyTournamentHistoryResponseDto {
  @ApiProperty({ type: () => [MyTournamentHistoryItemDto] })
  items!: MyTournamentHistoryItemDto[];

  @ApiProperty({ type: () => MyTournamentHistoryPaginationDto })
  pagination!: MyTournamentHistoryPaginationDto;
}
