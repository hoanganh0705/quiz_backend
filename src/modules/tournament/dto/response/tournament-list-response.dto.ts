import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpcomingTournamentItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Challenge' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Tournament description',
    type: String,
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Start timestamp (ISO 8601)',
    example: '2026-07-01T00:00:00Z',
  })
  startAt!: string;

  @ApiProperty({
    description: 'End timestamp (ISO 8601)',
    example: '2026-07-10T00:00:00Z',
  })
  endAt!: string;

  @ApiProperty({ description: 'Number of registered participants', example: 523 })
  participantCount!: number;
}

export class UpcomingTournamentsPaginationDto {
  @ApiProperty({ description: 'Total number of upcoming tournaments', example: 50 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}

export class UpcomingTournamentsResponseDto {
  @ApiProperty({
    description: 'Upcoming tournaments ordered by start time',
    type: () => [UpcomingTournamentItemDto],
  })
  items!: UpcomingTournamentItemDto[];

  @ApiProperty({
    description: 'Offset pagination metadata',
    type: () => UpcomingTournamentsPaginationDto,
  })
  pagination!: UpcomingTournamentsPaginationDto;
}

export class ActiveTournamentItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Challenge' })
  name!: string;

  @ApiProperty({
    description: 'Start timestamp (ISO 8601)',
    example: '2026-06-01T00:00:00Z',
  })
  startAt!: string;

  @ApiProperty({
    description: 'End timestamp (ISO 8601)',
    example: '2026-06-10T00:00:00Z',
  })
  endAt!: string;

  @ApiProperty({ description: 'Number of registered participants', example: 523 })
  participantCount!: number;
}

export class ActiveTournamentsPaginationDto {
  @ApiProperty({ description: 'Total number of active tournaments', example: 20 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}

export class ActiveTournamentsResponseDto {
  @ApiProperty({
    description: 'Currently active tournaments ordered by start time',
    type: () => [ActiveTournamentItemDto],
  })
  items!: ActiveTournamentItemDto[];

  @ApiProperty({
    description: 'Offset pagination metadata',
    type: () => ActiveTournamentsPaginationDto,
  })
  pagination!: ActiveTournamentsPaginationDto;
}

export class CompletedTournamentItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Spring Challenge' })
  name!: string;

  @ApiProperty({
    description: 'Start timestamp (ISO 8601)',
    example: '2026-05-01T00:00:00Z',
  })
  startAt!: string;

  @ApiProperty({
    description: 'End timestamp (ISO 8601)',
    example: '2026-05-10T00:00:00Z',
  })
  endAt!: string;

  @ApiProperty({ description: 'Number of registered participants', example: 523 })
  participantCount!: number;
}

export class CompletedTournamentsPaginationDto {
  @ApiProperty({ description: 'Total number of completed tournaments', example: 150 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}

export class CompletedTournamentsResponseDto {
  @ApiProperty({
    description: 'Completed tournaments ordered by most recent end time',
    type: () => [CompletedTournamentItemDto],
  })
  items!: CompletedTournamentItemDto[];

  @ApiProperty({
    description: 'Offset pagination metadata',
    type: () => CompletedTournamentsPaginationDto,
  })
  pagination!: CompletedTournamentsPaginationDto;
}

export class RelatedTournamentItemDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament name', example: 'Backend Challenge' })
  name!: string;

  @ApiProperty({
    description: 'Start timestamp (ISO 8601)',
    example: '2026-07-01T00:00:00Z',
  })
  startAt!: string;

  @ApiProperty({ description: 'Number of registered participants', example: 312 })
  participantCount!: number;
}

export class RelatedTournamentsResponseDto {
  @ApiProperty({
    description: 'Tournaments related to the source tournament, ordered by relevance',
    type: () => [RelatedTournamentItemDto],
  })
  items!: RelatedTournamentItemDto[];
}
