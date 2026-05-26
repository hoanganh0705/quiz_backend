import {
  Body,
  Controller,
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
} from '@nestjs/swagger';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { TournamentApplicationService } from '../../application/tournament.application.service';
import { CreateTournamentDto, ListTournamentsQueryDto } from '../../dto/request';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentListResponseDto,
  TournamentLeaderboardResponseDto,
  RegisterTournamentResponseDto,
  StartTournamentAttemptResponseDto,
} from '../../dto/response';
import { TournamentDomainExceptionFilter } from '../filters/tournament-domain-exception.filter';

@ApiTags('tournaments')
@Controller('tournaments')
@UseFilters(TournamentDomainExceptionFilter)
export class TournamentController {
  constructor(private readonly tournamentApplicationService: TournamentApplicationService) {}

  @Post()
  @Permissions(Permission.TOURNAMENT_CREATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create tournament',
    description: 'Creates a new tournament. Requires `tournament:create` permission.',
  })
  @ApiCreatedResponse({ description: 'Tournament created', type: TournamentResponseDto })
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
  listTournaments(@Query() query: ListTournamentsQueryDto): Promise<TournamentListResponseDto> {
    return this.tournamentApplicationService.listTournaments(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get tournament by ID',
    description: 'Returns tournament details including rounds and participant count.',
  })
  @ApiOkResponse({ description: 'Tournament found', type: TournamentDetailResponseDto })
  getTournamentById(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentDetailResponseDto> {
    return this.tournamentApplicationService.getTournamentById(tournamentId);
  }

  @Post(':id/register')
  @Permissions(Permission.TOURNAMENT_REGISTER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register for tournament',
    description:
      'Registers the authenticated user for a tournament. Requires `tournament:register` permission.',
  })
  @ApiCreatedResponse({
    description: 'Registered successfully',
    type: RegisterTournamentResponseDto,
  })
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
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ): Promise<TournamentLeaderboardResponseDto> {
    return this.tournamentApplicationService.getLeaderboard(tournamentId);
  }

  @Post(':id/rounds/:roundId/attempts')
  @Permissions(Permission.TOURNAMENT_ATTEMPT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start round attempt',
    description:
      'Starts a tournament round attempt for the authenticated participant. Requires `tournament:attempt` permission.',
  })
  @ApiCreatedResponse({ description: 'Attempt started', type: StartTournamentAttemptResponseDto })
  startRoundAttempt(
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartTournamentAttemptResponseDto> {
    return this.tournamentApplicationService.startRoundAttempt(tournamentId, roundId, user);
  }
}
