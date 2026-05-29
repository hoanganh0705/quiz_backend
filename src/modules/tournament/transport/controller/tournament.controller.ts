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
}
