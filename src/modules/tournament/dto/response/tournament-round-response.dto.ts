import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TOURNAMENT_ROUND_STATUSES,
  type TournamentRoundStatus,
} from '../../types/tournament.types';

export class TournamentRoundResponseDto {
  @ApiProperty({ description: 'Round identifier', example: '550e8400-e29b-71d4-a716-446655440001' })
  roundId!: string;

  @ApiProperty({
    description: 'Parent tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Round number (1-based)', example: 1 })
  roundNumber!: number;

  @ApiProperty({ description: 'Round name', example: 'Quarter Finals' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Round description',
    type: String,
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Quiz version used in this round',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiPropertyOptional({
    description: 'Scheduled start timestamp (ISO 8601)',
    type: String,
    example: '2025-07-01T10:00:00.000Z',
    nullable: true,
  })
  startAt!: string | null;

  @ApiPropertyOptional({
    description: 'Scheduled end timestamp (ISO 8601)',
    type: String,
    example: '2025-07-01T12:00:00.000Z',
    nullable: true,
  })
  endAt!: string | null;

  @ApiPropertyOptional({
    description: 'Round duration in milliseconds',
    type: Number,
    example: 3_600_000,
    nullable: true,
  })
  durationMs!: number | null;

  @ApiProperty({
    description: 'Round status',
    enum: TOURNAMENT_ROUND_STATUSES,
    example: 'pending',
  })
  status!: TournamentRoundStatus;

  @ApiProperty({ description: 'Whether incorrect answers result in elimination', example: true })
  isElimination!: boolean;

  @ApiPropertyOptional({
    description: 'Maximum participants in this round',
    type: Number,
    example: 100,
    nullable: true,
  })
  participantLimit!: number | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}
