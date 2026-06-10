import { ApiProperty } from '@nestjs/swagger';
import type { TournamentStatus } from '@/modules/tournament/types/tournament.types';

export class MyTournamentItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'Tournament name',
    example: 'Spring Challenge',
  })
  name!: string;

  @ApiProperty({
    description: 'Tournament lifecycle status',
    enum: ['upcoming', 'registration', 'ongoing', 'finished', 'cancelled'],
    example: 'upcoming',
  })
  status!: TournamentStatus;

  @ApiProperty({
    description: 'Timestamp when the user registered for or first participated in the tournament',
    example: '2026-06-01T00:00:00Z',
  })
  registeredAt!: string;

  @ApiProperty({
    description: 'Tournament start timestamp in ISO 8601 format',
    example: '2026-06-05T00:00:00Z',
  })
  startAt!: string;

  @ApiProperty({
    description: 'Tournament end timestamp in ISO 8601 format',
    example: '2026-06-10T00:00:00Z',
  })
  endAt!: string;
}

export class MyTournamentsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'Cursor for the next page (base64-encoded { registeredAt, participantId })',
    nullable: true,
    example: 'eyJyZWdpc3RlcmVkQXQiOiAiMjAyNi0wNi0wMVQwMDowMDowMFoiLCAicGFydGljaXBhbnRJZCI6ICI2NjBlODQwMC1lMjliLTMxZDQtYTcxNi00NDY2NTY1NDQwMDAifQ==',
  })
  nextCursor!: string | null;
}

export class MyTournamentsResponseDto {
  @ApiProperty({ type: () => [MyTournamentItemDto] })
  items!: MyTournamentItemDto[];

  @ApiProperty({ type: () => MyTournamentsPaginationDto })
  pagination!: MyTournamentsPaginationDto;
}
