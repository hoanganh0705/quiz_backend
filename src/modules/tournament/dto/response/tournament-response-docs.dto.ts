import { ApiProperty } from '@nestjs/swagger';
import { TournamentResponseDto, TournamentDetailResponseDto } from './tournament-response.dto';
import { TournamentLeaderboardResponseDto } from './tournament-leaderboard-response.dto';
import { TournamentWinnersResponseDto } from './tournament-winners-response.dto';
import { TournamentParticipantsResponseDto } from './tournament-participants-response.dto';
import {
  UpcomingTournamentsResponseDto,
  ActiveTournamentsResponseDto,
  CompletedTournamentsResponseDto,
  RelatedTournamentsResponseDto,
} from './tournament-list-response.dto';
import {
  TournamentStatsResponseDto,
  MyTournamentStandingResponseDto,
} from './tournament-stats-response.dto';
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
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse
// decorators to document the actual wrapped shape in the OpenAPI spec.
//
// Two distinct runtime error shapes must be documented:
//
//   1. Global / Nest HttpException errors
//      (400 from class-validator, 401 from JwtGuard, 403 from PermissionsGuard,
//       500 from unhandled errors)
//      → handled by GlobalExceptionFilter → emits RFC 7807 ProblemDetail
//        { type, title, status, detail, instance, extensions }
//
//   2. Tournament domain errors
//      (TournamentNotFoundError, TournamentForbiddenError, TournamentConflictError,
//       TournamentValidationError, TournamentRegistrationClosedError, TournamentFullError,
//       TournamentAlreadyRegisteredError, TournamentRoundNotFoundError,
//       TournamentRoundNotOpenError, TournamentAttemptAlreadyExistsError,
//       TournamentNotRegisteredError, TournamentUnregisterClosedError,
//       TournamentParticipantStateError, TournamentWithdrawClosedError)
//      → handled by TournamentDomainExceptionFilter → emits
//        { statusCode: number, message: string, error: string }
//
// Both shapes are documented below.

// ─── Error response schemas ─────────────────────────────────────────────────────

export class TournamentDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the tournament domain exception filter',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Human-readable message produced by the tournament domain exception filter',
    example: 'Tournament not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status text produced by the tournament domain exception filter',
    example: 'Not Found',
  })
  error!: string;
}

// ─── Meta schemas ───────────────────────────────────────────────────────────────

class TournamentResponseMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedTournamentResponseDto {
  @ApiProperty({ description: 'Tournament data', type: () => TournamentResponseDto })
  data!: TournamentResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedTournamentDetailResponseDto {
  @ApiProperty({ description: 'Tournament detail', type: () => TournamentDetailResponseDto })
  data!: TournamentDetailResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedTournamentWinnersResponseDto {
  @ApiProperty({ description: 'Tournament winners', type: () => TournamentWinnersResponseDto })
  data!: TournamentWinnersResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedTournamentStatsResponseDto {
  @ApiProperty({ description: 'Tournament stats', type: () => TournamentStatsResponseDto })
  data!: TournamentStatsResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedMyTournamentStandingResponseDto {
  @ApiProperty({ description: 'User standing', type: () => MyTournamentStandingResponseDto })
  data!: MyTournamentStandingResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedRegisterTournamentResponseDto {
  @ApiProperty({ description: 'Registration result', type: () => RegisterTournamentResponseDto })
  data!: RegisterTournamentResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedStartTournamentAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt start result',
    type: () => StartTournamentAttemptResponseDto,
  })
  data!: StartTournamentAttemptResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedUnregisterTournamentResponseDto {
  @ApiProperty({ description: 'Unregister result', type: () => UnregisterTournamentResponseDto })
  data!: UnregisterTournamentResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedWithdrawTournamentResponseDto {
  @ApiProperty({ description: 'Withdrawal result', type: () => WithdrawTournamentResponseDto })
  data!: WithdrawTournamentResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedTournamentLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries wrapped in the TournamentLeaderboardResponseDto shape',
    type: () => TournamentLeaderboardResponseDto,
  })
  data!: TournamentLeaderboardResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

export class WrappedRelatedTournamentsResponseDto {
  @ApiProperty({
    description: 'Related tournaments wrapped in the RelatedTournamentsResponseDto shape',
    type: () => RelatedTournamentsResponseDto,
  })
  data!: RelatedTournamentsResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentResponseMetaDto,
  })
  meta!: TournamentResponseMetaDto;
}

// ─── Paginated wrappers ────────────────────────────────────────────────────────
//
// For paginated responses, ResponseFormatInterceptor wraps the root-level
// { items, pagination } as { data: items, meta: { timestamp, pagination } }.
//

class TournamentCursorPaginationMetaDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  limit!: number;

  @ApiProperty({
    description:
      'Opaque cursor string for fetching the next page. `null` when there is no next page. ' +
      'Pass this value as the `cursor` query parameter on the next request to continue pagination.',
    type: String,
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTI1VDEwOjMwOjAwLjAwMFoiLCJ0b3VybmFtZW50SWQiOiI2NjBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ',
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

class TournamentOffsetPaginationMetaDto {
  @ApiProperty({ description: 'Total number of matching records', example: 523 })
  total!: number;

  @ApiProperty({ description: 'Current page number (1-based)', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}

class TournamentCursorMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Cursor pagination metadata',
    type: () => TournamentCursorPaginationMetaDto,
  })
  pagination!: TournamentCursorPaginationMetaDto;
}

class TournamentOffsetMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Offset/limit pagination metadata',
    type: () => TournamentOffsetPaginationMetaDto,
  })
  pagination!: TournamentOffsetPaginationMetaDto;
}

export class WrappedTournamentListResponseDto {
  @ApiProperty({
    description: 'Tournament list items',
    type: () => [TournamentResponseDto],
  })
  data!: TournamentResponseDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentCursorMetaDto,
  })
  meta!: TournamentCursorMetaDto;
}

export class WrappedTournamentParticipantsResponseDto {
  @ApiProperty({
    description: 'Tournament participant list with offset/limit pagination',
    type: () => TournamentParticipantsResponseDto,
  })
  data!: TournamentParticipantsResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentOffsetMetaDto,
  })
  meta!: TournamentOffsetMetaDto;
}

export class WrappedUpcomingTournamentsResponseDto {
  @ApiProperty({
    description: 'Upcoming tournament list with offset/limit pagination',
    type: () => UpcomingTournamentsResponseDto,
  })
  data!: UpcomingTournamentsResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentOffsetMetaDto,
  })
  meta!: TournamentOffsetMetaDto;
}

export class WrappedActiveTournamentsResponseDto {
  @ApiProperty({
    description: 'Active tournament list with offset/limit pagination',
    type: () => ActiveTournamentsResponseDto,
  })
  data!: ActiveTournamentsResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentOffsetMetaDto,
  })
  meta!: TournamentOffsetMetaDto;
}

export class WrappedCompletedTournamentsResponseDto {
  @ApiProperty({
    description: 'Completed tournament list with offset/limit pagination',
    type: () => CompletedTournamentsResponseDto,
  })
  data!: CompletedTournamentsResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => TournamentOffsetMetaDto,
  })
  meta!: TournamentOffsetMetaDto;
}
