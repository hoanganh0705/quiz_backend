import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/swagger/swagger-schemas';
import { TournamentResponseDto, TournamentDetailResponseDto, TournamentListResponseDto } from './tournament-response.dto';
import { TournamentLeaderboardResponseDto } from './tournament-leaderboard-response.dto';
import { TournamentWinnersResponseDto } from './tournament-winners-response.dto';
import { TournamentParticipantsResponseDto } from './tournament-participants-response.dto';
import {
  UpcomingTournamentsResponseDto,
  ActiveTournamentsResponseDto,
  CompletedTournamentsResponseDto,
  RelatedTournamentsResponseDto,
} from './tournament-list-response.dto';
import { TournamentStatsResponseDto, MyTournamentStandingResponseDto } from './tournament-stats-response.dto';
import {
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
  UnregisterTournamentResponseDto,
  WithdrawTournamentResponseDto,
} from './tournament-action-response.dto';

// ─── Tournament module documentation-only wrapper DTOs ────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated payloads ({ items, pagination }), the interceptor extracts
// the items as data and nests pagination inside meta:
//   { data: items, meta: { timestamp, pagination } }
//
// Runtime DTOs live in their own response DTO files and are imported here for
// use in wrapper type refs.
//
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse
// decorators to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Paginated meta ─────────────────────────────────────────────────────────────

class TournamentParticipantsMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Participants cursor-pagination metadata' })
  pagination!: PaginationMetaDto;
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedTournamentResponseDto {
  @ApiProperty({ description: 'Tournament data', type: () => TournamentResponseDto })
  data!: TournamentResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedTournamentDetailResponseDto {
  @ApiProperty({ description: 'Tournament detail', type: () => TournamentDetailResponseDto })
  data!: TournamentDetailResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedTournamentWinnersResponseDto {
  @ApiProperty({ description: 'Tournament winners', type: () => TournamentWinnersResponseDto })
  data!: TournamentWinnersResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedTournamentStatsResponseDto {
  @ApiProperty({ description: 'Tournament stats', type: () => TournamentStatsResponseDto })
  data!: TournamentStatsResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedMyTournamentStandingResponseDto {
  @ApiProperty({ description: 'User standing', type: () => MyTournamentStandingResponseDto })
  data!: MyTournamentStandingResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedRegisterTournamentResponseDto {
  @ApiProperty({ description: 'Registration result', type: () => RegisterTournamentResponseDto })
  data!: RegisterTournamentResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedStartTournamentAttemptResponseDto {
  @ApiProperty({ description: 'Attempt start result', type: () => StartTournamentAttemptResponseDto })
  data!: StartTournamentAttemptResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedUnregisterTournamentResponseDto {
  @ApiProperty({ description: 'Unregister result', type: () => UnregisterTournamentResponseDto })
  data!: UnregisterTournamentResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedWithdrawTournamentResponseDto {
  @ApiProperty({ description: 'Withdrawal result', type: () => WithdrawTournamentResponseDto })
  data!: WithdrawTournamentResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

// ─── Paginated wrappers ────────────────────────────────────────────────────────
//
// For paginated responses, ResponseFormatInterceptor wraps the root-level
// { items, pagination } as { data: items, meta: { timestamp, pagination } }.
//

export class WrappedTournamentListResponseDto {
  @ApiProperty({
    description: 'Tournament list items',
    type: () => [TournamentResponseDto],
  })
  data!: TournamentResponseDto[];

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string; pagination: PaginationMetaDto };
}

export class WrappedTournamentLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => TournamentLeaderboardResponseDto,
  })
  data!: TournamentLeaderboardResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedTournamentParticipantsResponseDto {
  @ApiProperty({
    description: 'Tournament participant items',
    type: () => TournamentParticipantsResponseDto,
  })
  data!: TournamentParticipantsResponseDto;

  @ApiProperty({ description: 'Response metadata', type: TournamentParticipantsMetaDto })
  meta!: TournamentParticipantsMetaDto;
}

export class WrappedUpcomingTournamentsResponseDto {
  @ApiProperty({
    description: 'Upcoming tournament items',
    type: () => UpcomingTournamentsResponseDto,
  })
  data!: UpcomingTournamentsResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedActiveTournamentsResponseDto {
  @ApiProperty({
    description: 'Active tournament items',
    type: () => ActiveTournamentsResponseDto,
  })
  data!: ActiveTournamentsResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedCompletedTournamentsResponseDto {
  @ApiProperty({
    description: 'Completed tournament items',
    type: () => CompletedTournamentsResponseDto,
  })
  data!: CompletedTournamentsResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedRelatedTournamentsResponseDto {
  @ApiProperty({
    description: 'Related tournament items',
    type: () => RelatedTournamentsResponseDto,
  })
  data!: RelatedTournamentsResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}
