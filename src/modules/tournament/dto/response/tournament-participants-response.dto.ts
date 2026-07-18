import { ApiProperty } from '@nestjs/swagger';

export class TournamentParticipantListItemDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'Anh' })
  username!: string;

  @ApiProperty({
    description: 'Registration timestamp (ISO 8601)',
    example: '2026-06-01T00:00:00Z',
  })
  registeredAt!: string;
}

export class TournamentParticipantsPaginationDto {
  @ApiProperty({ description: 'Total number of matching records', example: 523 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}

export class TournamentParticipantsResponseDto {
  @ApiProperty({
    description: 'Tournament participant items',
    type: () => [TournamentParticipantListItemDto],
  })
  items!: TournamentParticipantListItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => TournamentParticipantsPaginationDto,
  })
  pagination!: TournamentParticipantsPaginationDto;

  @ApiProperty({
    description: 'Total number of participants registered in the tournament',
    example: 523,
  })
  totalParticipants!: number;
}
