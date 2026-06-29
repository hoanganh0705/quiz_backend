import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { TournamentApplicationService } from '../../application/tournament.application.service';
import {
  CreateTournamentDto,
  ListTournamentsQueryDto,
  GetTournamentParticipantsQueryDto,
  GetTournamentWinnersQueryDto,
  GetUpcomingTournamentsQueryDto,
  GetActiveTournamentsQueryDto,
  GetCompletedTournamentsQueryDto,
  GetRelatedTournamentsQueryDto,
} from '../../dto/request';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentListResponseDto,
  TournamentLeaderboardResponseDto,
  TournamentWinnersResponseDto,
  TournamentParticipantsResponseDto,
  UpcomingTournamentsResponseDto,
  ActiveTournamentsResponseDto,
  CompletedTournamentsResponseDto,
  RelatedTournamentsResponseDto,
  TournamentStatsResponseDto,
  MyTournamentStandingResponseDto,
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
  UnregisterTournamentResponseDto,
  WithdrawTournamentResponseDto,
} from '../../dto/response';
import {
  TournamentDomainErrorDto,
  WrappedTournamentResponseDto,
  WrappedTournamentDetailResponseDto,
  WrappedTournamentListResponseDto,
  WrappedTournamentLeaderboardResponseDto,
  WrappedTournamentWinnersResponseDto,
  WrappedTournamentParticipantsResponseDto,
  WrappedUpcomingTournamentsResponseDto,
  WrappedActiveTournamentsResponseDto,
  WrappedCompletedTournamentsResponseDto,
  WrappedRelatedTournamentsResponseDto,
  WrappedTournamentStatsResponseDto,
  WrappedMyTournamentStandingResponseDto,
  WrappedRegisterTournamentResponseDto,
  WrappedStartTournamentAttemptResponseDto,
  WrappedUnregisterTournamentResponseDto,
  WrappedWithdrawTournamentResponseDto,
} from '../../dto/response/tournament-response-docs.dto';
import { TournamentDomainExceptionFilter } from '../filters/tournament-domain-exception.filter';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';

// Local helpers — these decorators emit the response schemas that match the
// actual runtime error shapes produced by TournamentDomainExceptionFilter:
//
//   { statusCode: number, message: string, error: string }
//
// Use these for any 400 / 403 / 404 / 409 produced by a tournament domain error.
// (401 is emitted by GlobalExceptionFilter as RFC 7807 ProblemDetail and is
// handled by the @ApiBearerAuth + ApiUnauthorizedResponse pair below.)
//
// NOTE: Multiple @Api* decorators targeting the same status code collapse
// to a single schema (the LAST one wins). When an endpoint can produce more
// than one error shape for the same status code, use a single decorator with
// `schema: { oneOf: [...] }` (see createTournament, unregisterFromTournament,
// startRoundAttempt, withdrawFromTournament for examples).

const tournamentNotFoundResponse = (description: string = 'Tournament not found') =>
  ApiNotFoundResponse({ description, type: TournamentDomainErrorDto });

const tournamentForbiddenResponse = (
  description: string = 'You do not have permission to manage this tournament',
) =>
  ApiForbiddenResponse({
    description:
      description +
      ' The response can be an RFC 7807 ProblemDetail (from PermissionsGuard) ' +
      'or a tournament domain error envelope.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProblemDetailDto) },
        { $ref: getSchemaPath(TournamentDomainErrorDto) },
      ],
    },
  });

const tournamentConflictResponse = (description: string = 'Resource conflict') =>
  ApiConflictResponse({
    description,
    type: TournamentDomainErrorDto,
  });

const tournamentUnauthorizedResponse = (
  description: string = 'Missing or invalid authentication token',
) =>
  applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description,
      type: ProblemDetailDto,
      example: ErrorResponseExamples.unauthorized,
    }),
  );

@ApiTags('tournaments')
@Controller('tournaments')
@UseFilters(TournamentDomainExceptionFilter)
@ApiExtraModels(ProblemDetailDto, TournamentDomainErrorDto)
export class TournamentController {
  constructor(private readonly tournamentApplicationService: TournamentApplicationService) {}

  // createTournament throws TournamentValidationError (400) when endAt <= startAt.
  // It never throws 404 or 409 — those are not part of the implementation.
  // 400 can be either RFC 7807 ProblemDetail (class-validator body validation)
  // or TournamentDomainErrorDto (TournamentValidationError for endAt <= startAt).
  @Post()
  @Permissions(Permission.TOURNAMENT_CREATE)
  @ApiOperation({
    summary: 'Create tournament',
    description:
      'Creates a new tournament. Requires the `TOURNAMENT_CREATE` permission. ' +
      'A 400 is returned when the request body fails validation (e.g. `endAt` is not after `startAt`).',
  })
  @tournamentUnauthorizedResponse()
  @ApiCreatedResponse({ description: 'Tournament created', type: WrappedTournamentResponseDto })
  @ApiBadRequestResponse({
    description:
      'Request body failed validation. The response can be an RFC 7807 ProblemDetail ' +
      '(from class-validator) or a tournament domain error envelope ' +
      '(e.g. endAt must be after startAt).',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProblemDetailDto) },
        { $ref: getSchemaPath(TournamentDomainErrorDto) },
      ],
    },
  })
  createTournament(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentApplicationService.createTournament(user, payload);
  }

  // listTournaments is a public cursor-paginated listing that does not throw
  // any tournament domain errors. 400 comes from class-validator (query
  // parameters). 500 from unhandled errors.
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List tournaments',
    description: 'Returns a cursor-paginated list of tournaments filtered by optional criteria.',
  })
  @ApiOkResponse({ description: 'Tournaments returned', type: WrappedTournamentListResponseDto })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  listTournaments(@Query() query: ListTournamentsQueryDto): Promise<TournamentListResponseDto> {
    return this.tournamentApplicationService.listTournaments(query);
  }

  // getUpcomingTournaments is a public offset-paginated listing that does not
  // throw any tournament domain errors.
  @Get('upcoming')
  @Public()
  @ApiOperation({
    summary: 'List upcoming tournaments',
    description:
      'Returns an offset-paginated list of tournaments that have not yet entered the registration phase. ' +
      'Sortable by `startAt` or `registrationDeadline`.',
  })
  @ApiOkResponse({
    description: 'Upcoming tournaments returned',
    type: WrappedUpcomingTournamentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  getUpcomingTournaments(
    @Query() query: GetUpcomingTournamentsQueryDto,
  ): Promise<UpcomingTournamentsResponseDto> {
    return this.tournamentApplicationService.getUpcomingTournaments(query);
  }

  // getActiveTournaments is a public offset-paginated listing.
  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'List active tournaments',
    description:
      'Returns an offset-paginated list of tournaments currently in the registration, ongoing, or starting-soon phases.',
  })
  @ApiOkResponse({
    description: 'Active tournaments returned',
    type: WrappedActiveTournamentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  getActiveTournaments(
    @Query() query: GetActiveTournamentsQueryDto,
  ): Promise<ActiveTournamentsResponseDto> {
    return this.tournamentApplicationService.getActiveTournaments(query);
  }

  // getCompletedTournaments is a public offset-paginated listing.
  @Get('completed')
  @Public()
  @ApiOperation({
    summary: 'List completed tournaments',
    description: 'Returns an offset-paginated list of finished tournaments.',
  })
  @ApiOkResponse({
    description: 'Completed tournaments returned',
    type: WrappedCompletedTournamentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  getCompletedTournaments(
    @Query() query: GetCompletedTournamentsQueryDto,
  ): Promise<CompletedTournamentsResponseDto> {
    return this.tournamentApplicationService.getCompletedTournaments(query);
  }

  // getRelatedTournaments throws TournamentNotFoundError (404) when the
  // source tournament does not exist.
  @Get(':id/related')
  @Public()
  @ApiOperation({
    summary: 'List related tournaments',
    description:
      'Returns tournaments related to the given tournament (same category or adjacent time window).',
  })
  @ApiOkResponse({
    description: 'Related tournaments returned',
    type: WrappedRelatedTournamentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path or query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getRelatedTournaments(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetRelatedTournamentsQueryDto,
  ): Promise<RelatedTournamentsResponseDto> {
    return this.tournamentApplicationService.getRelatedTournaments(tournamentId, query);
  }

  // getTournamentStats throws TournamentNotFoundError (404) when the
  // tournament does not exist.
  @Get(':id/stats')
  @Public()
  @ApiOperation({
    summary: 'Get tournament stats',
    description: 'Returns aggregate statistics for the given tournament.',
  })
  @ApiOkResponse({
    description: 'Tournament stats returned',
    type: WrappedTournamentStatsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path or query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getTournamentStats(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentStatsResponseDto> {
    return this.tournamentApplicationService.getTournamentStats(tournamentId);
  }

  // getTournamentWinners throws TournamentNotFoundError (404) when the
  // tournament does not exist.
  @Get(':id/winners')
  @Public()
  @ApiOperation({
    summary: 'Get tournament winners',
    description:
      'Returns the final winners of the tournament sorted by rank ascending. ' +
      'The default limit is 10; pass `limit` to fetch more.',
  })
  @ApiOkResponse({
    description: 'Tournament winners returned',
    type: WrappedTournamentWinnersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path or query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getTournamentWinners(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentWinnersQueryDto,
  ): Promise<TournamentWinnersResponseDto> {
    return this.tournamentApplicationService.getTournamentWinners(tournamentId, query);
  }

  // getTournamentById throws TournamentNotFoundError (404) when the
  // tournament does not exist.
  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get tournament by ID',
    description:
      'Returns a single tournament with its associated rounds, category info, and participant count.',
  })
  @ApiOkResponse({
    description: 'Tournament found',
    type: WrappedTournamentDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path parameter failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getTournamentById(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentDetailResponseDto> {
    return this.tournamentApplicationService.getTournamentById(tournamentId);
  }

  // getTournamentParticipants throws TournamentNotFoundError (404) when the
  // tournament does not exist.
  @Get(':id/participants')
  @Public()
  @ApiOperation({
    summary: 'List tournament participants',
    description:
      'Returns an offset-paginated list of users registered for the tournament, ' +
      'plus the total registered count.',
  })
  @ApiOkResponse({
    description: 'Participants returned',
    type: WrappedTournamentParticipantsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path or query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getTournamentParticipants(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentParticipantsQueryDto,
  ): Promise<TournamentParticipantsResponseDto> {
    return this.tournamentApplicationService.getTournamentParticipants(tournamentId, query);
  }

  // registerForTournament can throw:
  //   - TournamentRegistrationClosedError (400)     — status not 'registration'
  //   - TournamentFullError (400)                   — maxParticipants reached
  //   - TournamentNotFoundError (404)               — tournament missing
  //   - TournamentAlreadyRegisteredError (409)      — already active participant
  // 400 can also be a path-validation failure (ParseUUIDPipe) — RFC 7807 ProblemDetail.
  @Post(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiOperation({
    summary: 'Register for tournament',
    description:
      'Registers the authenticated user for the tournament. ' +
      'If the user previously withdrew, this reactivates their participant record. ' +
      'Requires the `TOURNAMENT_REGISTER` permission.',
  })
  @tournamentUnauthorizedResponse()
  @ApiOkResponse({
    description: 'Registered successfully',
    type: WrappedRegisterTournamentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed (RFC 7807 ProblemDetail), or the tournament ' +
      'domain rejected the registration (domain error envelope). ' +
      'Domain reasons: "Tournament registration is closed" or "Tournament is full".',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProblemDetailDto) },
        { $ref: getSchemaPath(TournamentDomainErrorDto) },
      ],
    },
  })
  @tournamentNotFoundResponse()
  @tournamentConflictResponse('You are already registered for this tournament')
  registerForTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RegisterTournamentResponseDto> {
    return this.tournamentApplicationService.registerForTournament(tournamentId, user);
  }

  // getLeaderboard throws TournamentNotFoundError (404) when the
  // tournament does not exist.
  @Get(':id/leaderboard')
  @Public()
  @ApiOperation({
    summary: 'Get tournament leaderboard',
    description:
      'Returns the live leaderboard for the tournament with each participant rank, score, and time.',
  })
  @ApiOkResponse({
    description: 'Leaderboard returned',
    type: WrappedTournamentLeaderboardResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path parameter failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentLeaderboardResponseDto> {
    return this.tournamentApplicationService.getLeaderboard(tournamentId);
  }

  // getMyTournamentStanding can throw:
  //   - TournamentNotFoundError (404)         — tournament missing
  //   - TournamentNotRegisteredError (404)    — user not registered
  //   - TournamentForbiddenError (403)        — user is withdrawn or no standing
  @Get(':id/my-standing')
  @ApiOperation({
    summary: 'Get my tournament standing',
    description:
      'Returns the authenticated user current rank, score, percentile, and total ' +
      'participants for the tournament. Requires the user to be an active participant.',
  })
  @tournamentUnauthorizedResponse()
  @ApiOkResponse({
    description: 'Standing returned',
    type: WrappedMyTournamentStandingResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Path parameter failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse('Tournament not found, or you are not registered for this tournament')
  @tournamentForbiddenResponse()
  getMyTournamentStanding(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentStandingResponseDto> {
    return this.tournamentApplicationService.getMyTournamentStanding(tournamentId, userId);
  }

  // startRoundAttempt can throw:
  //   - TournamentRoundNotOpenError (400)            — round not in 'open' status
  //   - TournamentNotFoundError (404)                — tournament missing
  //   - TournamentRoundNotFoundError (404)           — round missing
  //   - TournamentForbiddenError (403)               — user not an active participant
  //   - TournamentAttemptAlreadyExistsError (409)    — already submitted attempt
  // 400 can also be a path-validation failure (ParseUUIDPipe) — RFC 7807 ProblemDetail.
  @Post(':id/rounds/:roundId/attempts')
  @Permissions(Permission.TOURNAMENT_ATTEMPT)
  @ApiOperation({
    summary: 'Start round attempt',
    description:
      'Starts an attempt for the authenticated user on the given tournament round. ' +
      'Returns the new `attemptId` to be used with the attempt endpoints. ' +
      'Requires the `TOURNAMENT_ATTEMPT` permission.',
  })
  @tournamentUnauthorizedResponse()
  @ApiOkResponse({
    description: 'Attempt started',
    type: WrappedStartTournamentAttemptResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed (RFC 7807 ProblemDetail), or the tournament ' +
      'domain rejected the attempt start (domain error envelope). ' +
      'Domain reason: "Tournament round is not open".',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProblemDetailDto) },
        { $ref: getSchemaPath(TournamentDomainErrorDto) },
      ],
    },
  })
  @tournamentNotFoundResponse('Tournament not found, or tournament round not found')
  @tournamentForbiddenResponse()
  @tournamentConflictResponse('You have already submitted an attempt for this round')
  startRoundAttempt(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartTournamentAttemptResponseDto> {
    return this.tournamentApplicationService.startRoundAttempt(tournamentId, roundId, user);
  }

  // unregisterFromTournament can throw:
  //   - TournamentUnregisterClosedError (400)      — tournament not in 'registration'
  //   - TournamentNotFoundError (404)              — tournament missing
  //   - TournamentNotRegisteredError (404)         — user not registered
  //   - TournamentParticipantStateError (409)      — user already withdrawn
  //   - TournamentForbiddenError (403)             — participant not in 'active' state
  // 400 can also be a path-validation failure (ParseUUIDPipe) — RFC 7807 ProblemDetail.
  @Delete(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiOperation({
    summary: 'Unregister from tournament',
    description:
      'Removes the authenticated user from the tournament participant list. ' +
      'Only allowed while the tournament is still in the registration phase. ' +
      'Requires the `TOURNAMENT_REGISTER` permission.',
  })
  @tournamentUnauthorizedResponse()
  @ApiOkResponse({
    description: 'Withdrawn successfully',
    type: WrappedUnregisterTournamentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed (RFC 7807 ProblemDetail), or the tournament ' +
      'domain rejected the unregistration (domain error envelope). ' +
      'Domain reason: "Tournament unregistration is only allowed during the registration phase".',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProblemDetailDto) },
        { $ref: getSchemaPath(TournamentDomainErrorDto) },
      ],
    },
  })
  @tournamentNotFoundResponse('Tournament not found, or you are not registered for this tournament')
  @tournamentConflictResponse('Invalid participant state for this operation')
  @tournamentForbiddenResponse()
  unregisterFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<UnregisterTournamentResponseDto> {
    return this.tournamentApplicationService.unregisterFromTournament(tournamentId, user);
  }

  // withdrawFromTournament can throw:
  //   - TournamentWithdrawClosedError (400)          — tournament not in 'ongoing' status
  //   - TournamentNotFoundError (404)                — tournament missing
  //   - TournamentForbiddenError (403)               — user not a participant
  //   - TournamentParticipantStateError (409)        — user already withdrawn
  // 400 can also be a path-validation failure (ParseUUIDPipe) — RFC 7807 ProblemDetail.
  @Post(':id/withdraw')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiOperation({
    summary: 'Withdraw from ongoing tournament',
    description:
      'Withdraws the authenticated user from an ongoing tournament. ' +
      'Only allowed while the tournament status is `ongoing`. ' +
      'Requires the `TOURNAMENT_REGISTER` permission.',
  })
  @tournamentUnauthorizedResponse()
  @ApiOkResponse({
    description: 'Withdrawal successful',
    type: WrappedWithdrawTournamentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed (RFC 7807 ProblemDetail), or the tournament ' +
      'domain rejected the withdrawal (domain error envelope). ' +
      'Domain reason: "Tournament withdrawal is only allowed while the tournament is active".',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ProblemDetailDto) },
        { $ref: getSchemaPath(TournamentDomainErrorDto) },
      ],
    },
  })
  @tournamentNotFoundResponse()
  @tournamentForbiddenResponse()
  @tournamentConflictResponse('Invalid participant state for this operation')
  withdrawFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WithdrawTournamentResponseDto> {
    return this.tournamentApplicationService.withdrawFromTournament(tournamentId, user);
  }
}
