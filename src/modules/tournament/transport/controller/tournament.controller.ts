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
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
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
  TournamentParticipantsResponseDto,
  TournamentWinnersResponseDto,
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

import { TournamentDomainExceptionFilter } from '../filters/tournament-domain-exception.filter';

@ApiTags('tournaments')
@ApiBearerAuth()
@Controller('tournaments')
@UseFilters(TournamentDomainExceptionFilter)
export class TournamentController {
  constructor(private readonly tournamentApplicationService: TournamentApplicationService) {}

  @Post()
  @Permissions(Permission.TOURNAMENT_CREATE)
  @ApiAuth()
  @ApiOperation({
    summary: 'Create tournament',
    description: 'Creates a new tournament. Requires `tournament:create` permission.',
  })
  @ApiCreatedResponse({ description: 'Tournament created', type: TournamentResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid date range' })
  @ApiForbiddenResponse({ description: 'You do not have permission to create tournaments' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  createTournament(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentApplicationService.createTournament(user, payload);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List tournaments',
    description:
      'Returns a paginated list of tournaments. Supports filtering by status, difficulty, and category.',
  })
  @ApiOkResponse({ description: 'Tournaments returned', type: TournamentListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listTournaments(@Query() query: ListTournamentsQueryDto): Promise<TournamentListResponseDto> {
    return this.tournamentApplicationService.listTournaments(query);
  }

  @Get('upcoming')
  @Public()
  @ApiOperation({
    summary: 'List upcoming tournaments',
    description:
      'Returns tournaments that have not started yet, paginated by page and limit and ordered by the selected upcoming sort option.',
  })
  @ApiOkResponse({
    description: 'Upcoming tournaments returned',
    type: UpcomingTournamentsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getUpcomingTournaments(
    @Query() query: GetUpcomingTournamentsQueryDto,
  ): Promise<UpcomingTournamentsResponseDto> {
    return this.tournamentApplicationService.getUpcomingTournaments(query);
  }

  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'List active tournaments',
    description:
      'Returns tournaments currently running, paginated by page and limit and ordered by the nearest ending tournament first.',
  })
  @ApiOkResponse({ description: 'Active tournaments returned', type: ActiveTournamentsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getActiveTournaments(
    @Query() query: GetActiveTournamentsQueryDto,
  ): Promise<ActiveTournamentsResponseDto> {
    return this.tournamentApplicationService.getActiveTournaments(query);
  }

  @Get('completed')
  @Public()
  @ApiOperation({
    summary: 'List completed tournaments',
    description:
      'Returns tournaments that have already ended, paginated by page and limit and ordered by newest completed first.',
  })
  @ApiOkResponse({
    description: 'Completed tournaments returned',
    type: CompletedTournamentsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getCompletedTournaments(
    @Query() query: GetCompletedTournamentsQueryDto,
  ): Promise<CompletedTournamentsResponseDto> {
    return this.tournamentApplicationService.getCompletedTournaments(query);
  }

  @Get(':id/related')
  @Public()
  @ApiOperation({
    summary: 'List related tournaments',
    description:
      'Returns tournaments related to the specified tournament for discovery. Relatedness is determined by shared category, description keywords, and title similarity.',
  })
  @ApiOkResponse({
    description: 'Related tournaments returned',
    type: RelatedTournamentsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getRelatedTournaments(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetRelatedTournamentsQueryDto,
  ): Promise<RelatedTournamentsResponseDto> {
    return this.tournamentApplicationService.getRelatedTournaments(tournamentId, query);
  }

  @Get(':id/stats')
  @Public()
  @ApiOperation({
    summary: 'Get tournament stats',
    description:
      'Returns aggregated statistics for the specified tournament including participation, score, completion, and ranking metrics.',
  })
  @ApiOkResponse({ description: 'Tournament stats returned', type: TournamentStatsResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTournamentStats(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentStatsResponseDto> {
    return this.tournamentApplicationService.getTournamentStats(tournamentId);
  }

  @Get(':id/winners')
  @Public()
  @ApiOperation({
    summary: 'Get tournament winners',
    description:
      'Returns the final winners leaderboard for a completed tournament ordered by final score and the existing tournament tie-breaker rules.',
  })
  @ApiOkResponse({ description: 'Tournament winners returned', type: TournamentWinnersResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getTournamentWinners(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentWinnersQueryDto,
  ): Promise<TournamentWinnersResponseDto> {
    return this.tournamentApplicationService.getTournamentWinners(tournamentId, query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get tournament by ID',
    description: 'Returns tournament details including rounds and participant count.',
  })
  @ApiOkResponse({ description: 'Tournament found', type: TournamentDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTournamentById(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentDetailResponseDto> {
    return this.tournamentApplicationService.getTournamentById(tournamentId);
  }

  @Get(':id/participants')
  @Public()
  @ApiOperation({
    summary: 'List tournament participants',
    description:
      'Returns registered participants in the specified tournament, paginated by page and limit and ordered by most recent registration first.',
  })
  @ApiOkResponse({ description: 'Participants returned', type: TournamentParticipantsResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  getTournamentParticipants(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentParticipantsQueryDto,
  ): Promise<TournamentParticipantsResponseDto> {
    return this.tournamentApplicationService.getTournamentParticipants(tournamentId, query);
  }

  @Post(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuth()
  @ApiOperation({
    summary: 'Register for tournament',
    description:
      'Registers the authenticated user for a tournament. Requires `tournament:register` permission.',
  })
  @ApiCreatedResponse({
    description: 'Registered successfully',
    type: RegisterTournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiConflictResponse({ description: 'You are already registered for this tournament' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to register for this tournament',
  })
  @ApiBadRequestResponse({ description: 'Tournament is not open for registration' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  registerForTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RegisterTournamentResponseDto> {
    return this.tournamentApplicationService.registerForTournament(tournamentId, user);
  }

  @Get(':id/leaderboard')
  @Public()
  @ApiOperation({
    summary: 'Get tournament leaderboard',
    description: 'Returns the live tournament leaderboard sorted by score.',
  })
  @ApiOkResponse({ description: 'Leaderboard returned', type: TournamentLeaderboardResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentLeaderboardResponseDto> {
    return this.tournamentApplicationService.getLeaderboard(tournamentId);
  }

  @Get(':id/my-standing')
  @ApiAuth()
  @ApiOperation({
    summary: 'Get my tournament standing',
    description:
      "Returns the authenticated user's current standing within the specified tournament including rank, score, percentile, and participant count.",
  })
  @ApiOkResponse({ description: 'Standing returned', type: MyTournamentStandingResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found or you are not registered' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view your standing in this tournament',
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getMyTournamentStanding(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentStandingResponseDto> {
    return this.tournamentApplicationService.getMyTournamentStanding(tournamentId, userId);
  }

  @Post(':id/rounds/:roundId/attempts')
  @Permissions(Permission.TOURNAMENT_ATTEMPT)
  @ApiAuth()
  @ApiOperation({
    summary: 'Start round attempt',
    description:
      'Starts a tournament round attempt for the authenticated participant. Requires `tournament:attempt` permission.',
  })
  @ApiCreatedResponse({ description: 'Attempt started', type: StartTournamentAttemptResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament or round not found' })
  @ApiForbiddenResponse({ description: 'You are not registered for this tournament' })
  @ApiConflictResponse({ description: 'You have already started this round' })
  @ApiBadRequestResponse({ description: 'Round is not currently active' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  startRoundAttempt(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartTournamentAttemptResponseDto> {
    return this.tournamentApplicationService.startRoundAttempt(tournamentId, roundId, user);
  }

  @Delete(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuth()
  @ApiOperation({
    summary: 'Unregister from tournament',
    description:
      'Withdraws the authenticated user from a tournament. Only allowed when the tournament status is `registration`. Requires `tournament:register` permission.',
  })
  @ApiOkResponse({
    description: 'Withdrawn successfully',
    type: UnregisterTournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Tournament not found or you are not registered' })
  @ApiConflictResponse({ description: 'You have already withdrawn from this tournament' })
  @ApiForbiddenResponse({ description: 'Non-active participants cannot unregister' })
  @ApiBadRequestResponse({ description: 'Tournament is not in a state that allows unregistration' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  unregisterFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<UnregisterTournamentResponseDto> {
    return this.tournamentApplicationService.unregisterFromTournament(tournamentId, user);
  }

  @Post(':id/withdraw')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuth()
  @ApiOperation({
    summary: 'Withdraw from active tournament',
    description:
      'Withdraws the authenticated participant from an active tournament while preserving historical participation records. Requires `tournament:register` permission.',
  })
  @ApiOkResponse({ description: 'Withdrawal successful', type: WithdrawTournamentResponseDto })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiForbiddenResponse({ description: 'You are not an active participant in this tournament' })
  @ApiConflictResponse({
    description: 'You have already withdrawn from this tournament or the tournament is not active',
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  withdrawFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WithdrawTournamentResponseDto> {
    return this.tournamentApplicationService.withdrawFromTournament(tournamentId, user);
  }
}
