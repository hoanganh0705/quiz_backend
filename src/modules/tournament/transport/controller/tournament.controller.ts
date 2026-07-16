import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiUnauthorizedResponse,
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
  TournamentLeaderboardEntryDto,
  TournamentWinnerDto,
  TournamentParticipantListItemDto,
  UpcomingTournamentItemDto,
  ActiveTournamentItemDto,
  CompletedTournamentItemDto,
  RelatedTournamentItemDto,
  TournamentStatsResponseDto,
  MyTournamentStandingResponseDto,
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
  UnregisterTournamentResponseDto,
  WithdrawTournamentResponseDto,
} from '../../dto/response';
import { TournamentPresenter } from '../presenters/tournament.presenter';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { ApiOkResource, ApiCreatedResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import {
  ApiTournamentIdParam,
  ApiTournamentRoundIdParam,
} from '../swagger/tournament-swagger-decorators';
import {
  TOURNAMENT_DETAIL_EXAMPLE,
  TOURNAMENT_LIST_EXAMPLE,
  UPCOMING_TOURNAMENTS_EXAMPLE,
  ACTIVE_TOURNAMENTS_EXAMPLE,
  COMPLETED_TOURNAMENTS_EXAMPLE,
  RELATED_TOURNAMENTS_EXAMPLE,
  TOURNAMENT_LEADERBOARD_EXAMPLE,
  TOURNAMENT_WINNERS_EXAMPLE,
  TOURNAMENT_STATS_EXAMPLE,
  MY_STANDING_EXAMPLE,
  PARTICIPANTS_EXAMPLE,
  REGISTER_SUCCESS_EXAMPLE,
  START_ATTEMPT_SUCCESS_EXAMPLE,
  UNREGISTER_SUCCESS_EXAMPLE,
  WITHDRAW_SUCCESS_EXAMPLE,
  CREATE_TOURNAMENT_EXAMPLE,
} from '../swagger/examples';

// Local helpers — every tournament error response is now emitted by
// GlobalExceptionFilter as RFC 7807 ProblemDetail (the per-module filter
// was deleted in Phase 2). 401s were always emitted by GlobalExceptionFilter;
// 400/403/404/409 from tournament domain errors are too now. All helpers
// reference `ProblemDetailDto` and an example from `ErrorResponseExamples`.
//
// NOTE: Multiple @Api* decorators targeting the same status code collapse
// to a single schema (the LAST one wins). When an endpoint can produce more
// than one error reason for the same status code, prefer a single decorator
// with a description that enumerates them — the `oneOf` pattern from the
// pre-Phase-2 era is no longer needed because every response is now a
// single canonical shape.

const tournamentNotFoundResponse = (description: string = 'Tournament not found') =>
  ApiNotFoundResponse({
    description,
    type: ProblemDetailDto,
    example: ErrorResponseExamples.notFound,
  });

const tournamentForbiddenResponse = (
  description: string = 'Insufficient permissions for this action',
) =>
  ApiForbiddenResponse({
    description:
      description +
      '. Returns the RFC 7807 ProblemDetail envelope produced by GlobalExceptionFilter.',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.forbidden,
  });

const tournamentConflictResponse = (description: string = 'Resource conflict') =>
  ApiConflictResponse({
    description,
    type: ProblemDetailDto,
    example: ErrorResponseExamples.conflict,
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
@ApiExtraModels(ProblemDetailDto)
export class TournamentController {
  constructor(
    private readonly tournamentApplicationService: TournamentApplicationService,
    private readonly presenter: TournamentPresenter,
  ) {}

  // createTournament throws TournamentValidationError (400) when endAt <= startAt.
  // 400 can also be a class-validator body validation failure — also RFC 7807.
  @Post()
  @Permissions(Permission.TOURNAMENT_CREATE)
  @ApiOperation({
    summary: 'Create tournament',
    description:
      'Creates a new tournament. Requires the `TOURNAMENT_CREATE` permission. ' +
      'A 400 is returned when the request body fails validation (e.g. `endAt` is not after `startAt`).',
  })
  @tournamentUnauthorizedResponse()
  @ApiCreatedResource(TournamentResponseDto, {
    description: 'Tournament created',
    example: CREATE_TOURNAMENT_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Request body failed validation. The response is an RFC 7807 ProblemDetail ' +
      '(from class-validator or from the tournament domain for endAt <= startAt).',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  createTournament(@CurrentUser() user: JwtPayload, @Body() payload: CreateTournamentDto) {
    return this.tournamentApplicationService
      .createTournament(user, payload)
      .then((result) => this.presenter.createTournament(result));
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
  @ApiOkResourceList(TournamentResponseDto, 'cursor', {
    description: 'Tournaments returned',
    example: TOURNAMENT_LIST_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  listTournaments(@Query() query: ListTournamentsQueryDto) {
    return this.tournamentApplicationService
      .listTournaments(query)
      .then((result) => this.presenter.listTournaments(result));
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
  @ApiOkResourceList(UpcomingTournamentItemDto, 'offset', {
    description: 'Upcoming tournaments returned',
    example: UPCOMING_TOURNAMENTS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  getUpcomingTournaments(@Query() query: GetUpcomingTournamentsQueryDto) {
    return this.tournamentApplicationService
      .getUpcomingTournaments(query)
      .then((result) => this.presenter.getUpcomingTournaments(result));
  }

  // getActiveTournaments is a public offset-paginated listing.
  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'List active tournaments',
    description:
      'Returns an offset-paginated list of tournaments currently in the registration, ongoing, or starting-soon phases.',
  })
  @ApiOkResourceList(ActiveTournamentItemDto, 'offset', {
    description: 'Active tournaments returned',
    example: ACTIVE_TOURNAMENTS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  getActiveTournaments(@Query() query: GetActiveTournamentsQueryDto) {
    return this.tournamentApplicationService
      .getActiveTournaments(query)
      .then((result) => this.presenter.getActiveTournaments(result));
  }

  // getCompletedTournaments is a public offset-paginated listing.
  @Get('completed')
  @Public()
  @ApiOperation({
    summary: 'List completed tournaments',
    description: 'Returns an offset-paginated list of finished tournaments.',
  })
  @ApiOkResourceList(CompletedTournamentItemDto, 'offset', {
    description: 'Completed tournaments returned',
    example: COMPLETED_TOURNAMENTS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  getCompletedTournaments(@Query() query: GetCompletedTournamentsQueryDto) {
    return this.tournamentApplicationService
      .getCompletedTournaments(query)
      .then((result) => this.presenter.getCompletedTournaments(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(RelatedTournamentItemDto, {
    description: 'Related tournaments returned',
    example: RELATED_TOURNAMENTS_EXAMPLE,
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
  ) {
    return this.tournamentApplicationService
      .getRelatedTournaments(tournamentId, query)
      .then((result) => this.presenter.getRelatedTournaments(result));
  }

  // getTournamentStats throws TournamentNotFoundError (404) when the
  // tournament does not exist.
  @Get(':id/stats')
  @Public()
  @ApiOperation({
    summary: 'Get tournament stats',
    description: 'Returns aggregate statistics for the given tournament.',
  })
  @ApiTournamentIdParam()
  @ApiOkResource(TournamentStatsResponseDto, {
    description: 'Tournament stats returned',
    example: TOURNAMENT_STATS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Path or query parameters failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getTournamentStats(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.tournamentApplicationService
      .getTournamentStats(tournamentId)
      .then((result) => this.presenter.getTournamentStats(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(TournamentWinnerDto, {
    description: 'Tournament winners returned',
    example: TOURNAMENT_WINNERS_EXAMPLE,
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
  ) {
    return this.tournamentApplicationService
      .getTournamentWinners(tournamentId, query)
      .then((result) => this.presenter.getTournamentWinners(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(TournamentDetailResponseDto, {
    description: 'Tournament found',
    example: TOURNAMENT_DETAIL_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Path parameter failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getTournamentById(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.tournamentApplicationService
      .getTournamentById(tournamentId)
      .then((result) => this.presenter.getTournamentById(result));
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
  @ApiTournamentIdParam()
  @ApiOkResourceList(TournamentParticipantListItemDto, 'offset', {
    description: 'Participants returned',
    example: PARTICIPANTS_EXAMPLE,
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
  ) {
    return this.tournamentApplicationService
      .getTournamentParticipants(tournamentId, query)
      .then((result) => this.presenter.getTournamentParticipants(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(RegisterTournamentResponseDto, {
    description: 'Registered successfully',
    example: REGISTER_SUCCESS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed, or the tournament domain rejected the registration. ' +
      'Returns the RFC 7807 ProblemDetail envelope. Domain reasons: "Tournament registration ' +
      'is closed" or "Tournament is full".',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  @tournamentConflictResponse('You are already registered for this tournament')
  registerForTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentApplicationService
      .registerForTournament(tournamentId, user)
      .then((result) => this.presenter.registerForTournament(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(TournamentLeaderboardEntryDto, {
    description: 'Leaderboard returned',
    example: TOURNAMENT_LEADERBOARD_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Path parameter failed validation',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  getLeaderboard(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.tournamentApplicationService
      .getLeaderboard(tournamentId)
      .then((result) => this.presenter.getLeaderboard(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(MyTournamentStandingResponseDto, {
    description: 'Standing returned',
    example: MY_STANDING_EXAMPLE,
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
  ) {
    return this.tournamentApplicationService
      .getMyTournamentStanding(tournamentId, userId)
      .then((result) => this.presenter.getMyTournamentStanding(result));
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
  @ApiTournamentIdParam()
  @ApiTournamentRoundIdParam()
  @ApiOkResource(StartTournamentAttemptResponseDto, {
    description: 'Attempt started',
    example: START_ATTEMPT_SUCCESS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed, or the tournament domain rejected the attempt start. ' +
      'Returns the RFC 7807 ProblemDetail envelope. Domain reason: "Tournament round is not open".',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse('Tournament not found, or tournament round not found')
  @tournamentForbiddenResponse()
  @tournamentConflictResponse('You have already submitted an attempt for this round')
  startRoundAttempt(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentApplicationService
      .startRoundAttempt(tournamentId, roundId, user)
      .then((result) => this.presenter.startRoundAttempt(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(UnregisterTournamentResponseDto, {
    description: 'Unregistered successfully',
    example: UNREGISTER_SUCCESS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed, or the tournament domain rejected the unregistration. ' +
      'Returns the RFC 7807 ProblemDetail envelope. Domain reason: "Tournament unregistration ' +
      'is only allowed during the registration phase".',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse('Tournament not found, or you are not registered for this tournament')
  @tournamentConflictResponse('Invalid participant state for this operation')
  @tournamentForbiddenResponse()
  unregisterFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentApplicationService
      .unregisterFromTournament(tournamentId, user)
      .then((result) => this.presenter.unregisterFromTournament(result));
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
  @ApiTournamentIdParam()
  @ApiOkResource(WithdrawTournamentResponseDto, {
    description: 'Withdrawal successful',
    example: WITHDRAW_SUCCESS_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Path parameter is malformed, or the tournament domain rejected the withdrawal. ' +
      'Returns the RFC 7807 ProblemDetail envelope. Domain reason: "Tournament withdrawal ' +
      'is only allowed while the tournament is active".',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  @tournamentNotFoundResponse()
  @tournamentForbiddenResponse()
  @tournamentConflictResponse('Invalid participant state for this operation')
  withdrawFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentApplicationService
      .withdrawFromTournament(tournamentId, user)
      .then((result) => this.presenter.withdrawFromTournament(result));
  }
}
