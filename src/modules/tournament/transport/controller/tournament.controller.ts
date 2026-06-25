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

import { ApiTags, ApiOperation, ApiOkResponse, ApiNotFoundResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  ApiAuth,
  ApiAuthList,
  ApiAuthCreate,
  ApiAuthAction,
  ApiPublicList,
  ApiInternalError,
  ApiConflict,
} from '@/common/swagger/swagger-decorators';
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
@Controller('tournaments')
@UseFilters(TournamentDomainExceptionFilter)
export class TournamentController {
  constructor(private readonly tournamentApplicationService: TournamentApplicationService) {}

  @Post()
  @Permissions(Permission.TOURNAMENT_CREATE)
  @ApiAuthCreate({ description: 'Tournament created', type: TournamentResponseDto })
  createTournament(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentApplicationService.createTournament(user, payload);
  }

  @Get()
  @Public()
  @ApiPublicList({ description: 'Tournaments returned', type: TournamentListResponseDto })
  listTournaments(@Query() query: ListTournamentsQueryDto): Promise<TournamentListResponseDto> {
    return this.tournamentApplicationService.listTournaments(query);
  }

  @Get('upcoming')
  @Public()
  @ApiPublicList({
    description: 'Upcoming tournaments returned',
    type: UpcomingTournamentsResponseDto,
  })
  getUpcomingTournaments(
    @Query() query: GetUpcomingTournamentsQueryDto,
  ): Promise<UpcomingTournamentsResponseDto> {
    return this.tournamentApplicationService.getUpcomingTournaments(query);
  }

  @Get('active')
  @Public()
  @ApiPublicList({ description: 'Active tournaments returned', type: ActiveTournamentsResponseDto })
  getActiveTournaments(
    @Query() query: GetActiveTournamentsQueryDto,
  ): Promise<ActiveTournamentsResponseDto> {
    return this.tournamentApplicationService.getActiveTournaments(query);
  }

  @Get('completed')
  @Public()
  @ApiPublicList({
    description: 'Completed tournaments returned',
    type: CompletedTournamentsResponseDto,
  })
  getCompletedTournaments(
    @Query() query: GetCompletedTournamentsQueryDto,
  ): Promise<CompletedTournamentsResponseDto> {
    return this.tournamentApplicationService.getCompletedTournaments(query);
  }

  @Get(':id/related')
  @Public()
  @ApiPublicList({
    description: 'Related tournaments returned',
    type: RelatedTournamentsResponseDto,
  })
  getRelatedTournaments(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetRelatedTournamentsQueryDto,
  ): Promise<RelatedTournamentsResponseDto> {
    return this.tournamentApplicationService.getRelatedTournaments(tournamentId, query);
  }

  @Get(':id/stats')
  @Public()
  @ApiPublicList({ description: 'Tournament stats returned', type: TournamentStatsResponseDto })
  getTournamentStats(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentStatsResponseDto> {
    return this.tournamentApplicationService.getTournamentStats(tournamentId);
  }

  @Get(':id/winners')
  @Public()
  @ApiPublicList({ description: 'Tournament winners returned', type: TournamentWinnersResponseDto })
  getTournamentWinners(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentWinnersQueryDto,
  ): Promise<TournamentWinnersResponseDto> {
    return this.tournamentApplicationService.getTournamentWinners(tournamentId, query);
  }

  @Get(':id')
  @Public()
  @ApiPublicList({ description: 'Tournament found', type: TournamentDetailResponseDto })
  getTournamentById(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentDetailResponseDto> {
    return this.tournamentApplicationService.getTournamentById(tournamentId);
  }

  @Get(':id/participants')
  @Public()
  @ApiPublicList({ description: 'Participants returned', type: TournamentParticipantsResponseDto })
  getTournamentParticipants(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentParticipantsQueryDto,
  ): Promise<TournamentParticipantsResponseDto> {
    return this.tournamentApplicationService.getTournamentParticipants(tournamentId, query);
  }

  @Post(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuthAction({ description: 'Registered successfully', type: RegisterTournamentResponseDto })
  registerForTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RegisterTournamentResponseDto> {
    return this.tournamentApplicationService.registerForTournament(tournamentId, user);
  }

  @Get(':id/leaderboard')
  @Public()
  @ApiPublicList({ description: 'Leaderboard returned', type: TournamentLeaderboardResponseDto })
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentLeaderboardResponseDto> {
    return this.tournamentApplicationService.getLeaderboard(tournamentId);
  }

  @Get(':id/my-standing')
  @ApiAuthList({ description: 'Standing returned', type: MyTournamentStandingResponseDto })
  @ApiInternalServerErrorResponse()
  getMyTournamentStanding(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentStandingResponseDto> {
    return this.tournamentApplicationService.getMyTournamentStanding(tournamentId, userId);
  }

  @Post(':id/rounds/:roundId/attempts')
  @Permissions(Permission.TOURNAMENT_ATTEMPT)
  @ApiAuthAction({ description: 'Attempt started', type: StartTournamentAttemptResponseDto })
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
  @ApiNotFoundResponse()
  @ApiConflict()
  @ApiInternalServerErrorResponse()
  unregisterFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<UnregisterTournamentResponseDto> {
    return this.tournamentApplicationService.unregisterFromTournament(tournamentId, user);
  }

  @Post(':id/withdraw')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuthAction({ description: 'Withdrawal successful', type: WithdrawTournamentResponseDto })
  withdrawFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WithdrawTournamentResponseDto> {
    return this.tournamentApplicationService.withdrawFromTournament(tournamentId, user);
  }
}
