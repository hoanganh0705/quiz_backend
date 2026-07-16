import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TOURNAMENT_PARTICIPANT_STATUSES } from '../../types/tournament.types';

export class RegisterTournamentResponseDto {
  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Registration timestamp (ISO 8601)',
    example: '2025-06-15T08:00:00.000Z',
  })
  registeredAt!: string;

  @ApiProperty({
    description: 'Registration result message',
    example: 'Successfully registered for the tournament',
  })
  message!: string;
}

export class StartTournamentAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier for the tournament round',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Quiz version identifier for this round',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({
    description: 'Attempt start message',
    example: 'Attempt started successfully. Use the attempt endpoint to continue.',
  })
  message!: string;
}

export class UnregisterTournamentResponseDto {
  @ApiProperty({
    description: 'Unregister result message',
    example: 'Successfully withdrawn from the tournament',
  })
  message!: string;
}

export class WithdrawTournamentResponseDto {
  @ApiProperty({ description: 'Whether the withdrawal succeeded', example: true })
  success!: boolean;

  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({
    description: 'Updated participant status',
    enum: TOURNAMENT_PARTICIPANT_STATUSES,
    example: 'withdrawn',
  })
  status!: string;

  @ApiProperty({
    description: 'Withdrawal timestamp (ISO 8601)',
    example: '2026-06-08T10:00:00Z',
  })
  withdrawnAt!: string;
}
