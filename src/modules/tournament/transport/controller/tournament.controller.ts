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
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  ApiAuthAction,
  ApiAuthCreateWithState,
  ApiPublicRead,
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
} from '../../dto/response';
import { TournamentDomainExceptionFilter } from '../filters/tournament-domain-exception.filter';

@ApiTags('tournaments')
@Controller('tournaments')
@UseFilters(TournamentDomainExceptionFilter)
export class TournamentController {
  constructor(private readonly tournamentApplicationService: TournamentApplicationService) {}

  @Post()
  @Permissions(Permission.TOURNAMENT_CREATE)
  @ApiAuthCreateWithState({
    description: 'Tournament created',
    type: WrappedTournamentResponseDto,
  })
  createTournament(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentApplicationService.createTournament(user, payload);
  }

  @Get()
  @Public()
  @ApiPublicRead({
    description: 'Tournaments returned',
    type: WrappedTournamentListResponseDto,
  })
  listTournaments(@Query() query: ListTournamentsQueryDto): Promise<TournamentListResponseDto> {
    return this.tournamentApplicationService.listTournaments(query);
  }

  @Get('upcoming')
  @Public()
  @ApiPublicRead({
    description: 'Upcoming tournaments returned',
    type: WrappedUpcomingTournamentsResponseDto,
  })
  getUpcomingTournaments(
    @Query() query: GetUpcomingTournamentsQueryDto,
  ): Promise<UpcomingTournamentsResponseDto> {
    return this.tournamentApplicationService.getUpcomingTournaments(query);
  }

  @Get('active')
  @Public()
  @ApiPublicRead({
    description: 'Active tournaments returned',
    type: WrappedActiveTournamentsResponseDto,
  })
  getActiveTournaments(
    @Query() query: GetActiveTournamentsQueryDto,
  ): Promise<ActiveTournamentsResponseDto> {
    return this.tournamentApplicationService.getActiveTournaments(query);
  }

  @Get('completed')
  @Public()
  @ApiPublicRead({
    description: 'Completed tournaments returned',
    type: WrappedCompletedTournamentsResponseDto,
  })
  getCompletedTournaments(
    @Query() query: GetCompletedTournamentsQueryDto,
  ): Promise<CompletedTournamentsResponseDto> {
    return this.tournamentApplicationService.getCompletedTournaments(query);
  }

  @Get(':id/related')
  @Public()
  @ApiPublicRead({
    description: 'Related tournaments returned',
    type: WrappedRelatedTournamentsResponseDto,
  })
  getRelatedTournaments(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetRelatedTournamentsQueryDto,
  ): Promise<RelatedTournamentsResponseDto> {
    return this.tournamentApplicationService.getRelatedTournaments(tournamentId, query);
  }

  @Get(':id/stats')
  @Public()
  @ApiPublicRead({
    description: 'Tournament stats returned',
    type: WrappedTournamentStatsResponseDto,
  })
  getTournamentStats(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentStatsResponseDto> {
    return this.tournamentApplicationService.getTournamentStats(tournamentId);
  }

  @Get(':id/winners')
  @Public()
  @ApiPublicRead({
    description: 'Tournament winners returned',
    type: WrappedTournamentWinnersResponseDto,
  })
  getTournamentWinners(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentWinnersQueryDto,
  ): Promise<TournamentWinnersResponseDto> {
    return this.tournamentApplicationService.getTournamentWinners(tournamentId, query);
  }

  @Get(':id')
  @Public()
  @ApiPublicRead({
    description: 'Tournament found',
    type: WrappedTournamentDetailResponseDto,
  })
  getTournamentById(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentDetailResponseDto> {
    return this.tournamentApplicationService.getTournamentById(tournamentId);
  }

  @Get(':id/participants')
  @Public()
  @ApiPublicRead({
    description: 'Participants returned',
    type: WrappedTournamentParticipantsResponseDto,
  })
  getTournamentParticipants(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: GetTournamentParticipantsQueryDto,
  ): Promise<TournamentParticipantsResponseDto> {
    return this.tournamentApplicationService.getTournamentParticipants(tournamentId, query);
  }

  @Post(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuthAction({
    description: 'Registered successfully',
    type: WrappedRegisterTournamentResponseDto,
  })
  registerForTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RegisterTournamentResponseDto> {
    return this.tournamentApplicationService.registerForTournament(tournamentId, user);
  }

  @Get(':id/leaderboard')
  @Public()
  @ApiPublicRead({
    description: 'Leaderboard returned',
    type: WrappedTournamentLeaderboardResponseDto,
  })
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentLeaderboardResponseDto> {
    return this.tournamentApplicationService.getLeaderboard(tournamentId);
  }

  @Get(':id/my-standing')
  @ApiAuthAction({
    description: 'Standing returned',
    type: WrappedMyTournamentStandingResponseDto,
  })
  getMyTournamentStanding(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<MyTournamentStandingResponseDto> {
    return this.tournamentApplicationService.getMyTournamentStanding(tournamentId, userId);
  }

  @Post(':id/rounds/:roundId/attempts')
  @Permissions(Permission.TOURNAMENT_ATTEMPT)
  @ApiAuthAction({
    description: 'Attempt started',
    type: WrappedStartTournamentAttemptResponseDto,
  })
  startRoundAttempt(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartTournamentAttemptResponseDto> {
    return this.tournamentApplicationService.startRoundAttempt(tournamentId, roundId, user);
  }

  @Delete(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuthAction({
    description: 'Withdrawn successfully',
    type: WrappedUnregisterTournamentResponseDto,
  })
  unregisterFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<UnregisterTournamentResponseDto> {
    return this.tournamentApplicationService.unregisterFromTournament(tournamentId, user);
  }

  @Post(':id/withdraw')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiAuthAction({
    description: 'Withdrawal successful',
    type: WrappedWithdrawTournamentResponseDto,
  })
  withdrawFromTournament(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WithdrawTournamentResponseDto> {
    return this.tournamentApplicationService.withdrawFromTournament(tournamentId, user);
  }
}
