import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TOURNAMENT_DIFFICULTIES,
  TOURNAMENT_STATUSES,
  type TournamentDifficulty,
  type TournamentStatus,
} from '../../types/tournament.types';
import { TournamentRoundResponseDto } from './tournament-round-response.dto';

export class TournamentResponseDto {
  @ApiProperty({
    description: 'Unique tournament identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament title', example: 'Weekly Trivia Challenge' })
  title!: string;

  @ApiPropertyOptional({
    description: 'Tournament description',
    type: String,
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Difficulty level',
    enum: TOURNAMENT_DIFFICULTIES,
    example: 'medium',
  })
  difficulty!: TournamentDifficulty;

  @ApiProperty({
    description: 'Lifecycle status',
    enum: TOURNAMENT_STATUSES,
    example: 'registration',
  })
  status!: TournamentStatus;

  @ApiPropertyOptional({
    description: 'Prize description',
    type: String,
    nullable: true,
  })
  prize!: string | null;

  @ApiProperty({
    description: 'Start timestamp (ISO 8601)',
    example: '2025-07-01T10:00:00.000Z',
  })
  startAt!: string;

  @ApiProperty({
    description: 'End timestamp (ISO 8601)',
    example: '2025-07-01T12:00:00.000Z',
  })
  endAt!: string;

  @ApiPropertyOptional({
    description: 'Maximum participants',
    type: Number,
    example: 100,
    nullable: true,
  })
  maxParticipants!: number | null;

  @ApiPropertyOptional({
    description: 'Associated category identifier',
    type: String,
    format: 'uuid',
    nullable: true,
  })
  categoryId!: string | null;

  @ApiProperty({
    description:
      'Phase 1 / Issue #2 — UUID of the user who created the tournament. ' +
      'Used by the authorization layer for `PATCH /tournaments/:id`, ' +
      '`DELETE /tournaments/:id`, and `POST /tournaments/:id/cancel`. ' +
      'The application-layer policy compares this against the JWT subject ' +
      'to decide whether the caller can mutate the tournament.',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  ownerUserId!: string;

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

export class TournamentDetailResponseDto extends TournamentResponseDto {
  @ApiPropertyOptional({
    description: 'Associated category name',
    type: String,
    nullable: true,
  })
  categoryName!: string | null;

  @ApiPropertyOptional({
    description: 'Associated category slug',
    type: String,
    nullable: true,
  })
  categorySlug!: string | null;

  @ApiProperty({ description: 'Number of registered participants', example: 47 })
  totalParticipants!: number;

  @ApiProperty({ description: 'Tournament rounds', type: () => [TournamentRoundResponseDto] })
  rounds!: TournamentRoundResponseDto[];
}

export class TournamentPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor for next page',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: true })
  hasNextPage!: boolean;
}

export class TournamentListResponseDto {
  @ApiProperty({ description: 'Tournament items', type: () => [TournamentResponseDto] })
  items!: TournamentResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => TournamentPaginationResponseDto,
  })
  pagination!: TournamentPaginationResponseDto;
}
