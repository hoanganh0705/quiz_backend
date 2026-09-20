import { ApiProperty } from '@nestjs/swagger';
import { TOURNAMENT_STATUSES } from '../../types/tournament.types';

export class CancelTournamentResponseDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'Updated lifecycle status (always `cancelled` after a successful cancel)',
    enum: TOURNAMENT_STATUSES,
    example: 'cancelled',
  })
  status!: 'cancelled';

  @ApiProperty({
    description: 'Timestamp at which the cancel took effect (ISO 8601)',
    example: '2026-07-20T10:00:00.000Z',
  })
  cancelledAt!: string;
}

export class SoftDeleteTournamentResponseDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description:
      'Timestamp at which the soft delete took effect (ISO 8601). The tournament row remains in the database for audit and reconciliation purposes; reads filter `deleted_at IS NULL` so the row is invisible to clients.',
    example: '2026-07-20T10:00:00.000Z',
  })
  deletedAt!: string;
}
