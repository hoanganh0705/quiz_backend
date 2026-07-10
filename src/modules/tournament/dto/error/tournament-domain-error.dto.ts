import { ApiProperty } from '@nestjs/swagger';

/**
 * RFC 7807-flavored error response produced by TournamentDomainExceptionFilter
 * for tournament domain errors (TournamentNotFoundError, TournamentForbiddenError,
 * TournamentConflictError, TournamentValidationError, TournamentRegistrationClosedError,
 * TournamentFullError, TournamentAlreadyRegisteredError, TournamentRoundNotFoundError,
 * TournamentRoundNotOpenError, TournamentAttemptAlreadyExistsError,
 * TournamentNotRegisteredError, TournamentUnregisterClosedError,
 * TournamentParticipantStateError, TournamentWithdrawClosedError).
 *
 * Distinct from the RFC 7807 ProblemDetail returned by GlobalExceptionFilter
 * (used for class-validator 400s, JwtGuard 401s, PermissionsGuard 403s, and
 * 500s). Endpoints that can produce both shapes for the same status code
 * document them via `schema: { oneOf: [...] }` (see `tournament.controller.ts`).
 */
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
