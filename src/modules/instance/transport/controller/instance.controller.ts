import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { InstanceService } from '../../domain/instance.service';
import { InstanceResponseMapper } from '../../mappers/instance-response.mapper';
import { CreateInstanceDto } from '../../dto/request';
import {
  InstanceDetailResponseDto,
  CreateInstanceResponseDto,
  JoinInstanceResponseDto,
  StartInstanceResponseDto,
  CloseInstanceResponseDto,
  InstanceLeaderboardResponseDto,
} from '../../dto/response';
import { InstanceDomainExceptionFilter } from '../filters/instance-domain-exception.filter';

@ApiTags('instances')
@ApiBearerAuth()
@Controller('instances')
@UseFilters(InstanceDomainExceptionFilter)
export class InstanceController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly mapper: InstanceResponseMapper,
  ) {}

  @Post()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create instance',
    description: 'Creates a new live quiz instance and sets the authenticated user as the host.',
  })
  @ApiCreatedResponse({ description: 'Instance created', type: CreateInstanceResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz version not found' })
  @ApiForbiddenResponse({ description: 'You do not have permission to create an instance for this quiz' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  async createInstance(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateInstanceDto,
  ): Promise<CreateInstanceResponseDto> {
    const result = await this.instanceService.createInstance({
      quizVersionId: payload.quizVersionId,
      user,
      maxPlayers: payload.maxPlayers ?? null,
    });

    return {
      instanceId: result.instanceId,
      message: 'Instance created successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get instance by ID',
    description: 'Returns the full instance record including current players.',
  })
  @ApiOkResponse({ description: 'Instance found', type: InstanceDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getInstanceById(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceDetailResponseDto> {
    return this.instanceService.getInstanceById(instanceId).then((row) => {
      return this.mapper.toInstanceDetailResponse(row, []);
    });
  }

  @Post(':id/join')
  @ApiAuth()
  @ApiOperation({
    summary: 'Join instance',
    description: 'Adds the authenticated user as a player in the instance.',
  })
  @ApiOkResponse({ description: 'Joined successfully', type: JoinInstanceResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiConflictResponse({ description: 'You are already a player in this instance or instance is full' })
  @ApiBadRequestResponse({ description: 'Instance is not open for joining' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  joinInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JoinInstanceResponseDto> {
    return this.instanceService.joinInstance(instanceId, user);
  }

  @Post(':id/start')
  @ApiAuth()
  @ApiOperation({
    summary: 'Start instance',
    description: 'Starts the instance, allowing all joined players to begin answering questions.',
  })
  @ApiOkResponse({ description: 'Instance started', type: StartInstanceResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiForbiddenResponse({ description: 'Only the host can start the instance' })
  @ApiConflictResponse({ description: 'Instance has already started or has no players' })
  @ApiBadRequestResponse({ description: 'Instance is not in a state that can be started' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  startInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartInstanceResponseDto> {
    return this.instanceService.startInstance(instanceId, user);
  }

  @Post(':id/close')
  @ApiAuth()
  @ApiOperation({
    summary: 'Close instance',
    description: 'Closes the instance and finalizes all player scores.',
  })
  @ApiOkResponse({ description: 'Instance closed', type: CloseInstanceResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiForbiddenResponse({ description: 'Only the host can close the instance' })
  @ApiConflictResponse({ description: 'Instance has already been closed' })
  @ApiBadRequestResponse({ description: 'Instance is not in a state that can be closed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  closeInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CloseInstanceResponseDto> {
    return this.instanceService.closeInstance(instanceId, user);
  }

  @Get(':id/leaderboard')
  @ApiOperation({
    summary: 'Get instance leaderboard',
    description: 'Returns the live leaderboard for a specific instance.',
  })
  @ApiOkResponse({ description: 'Leaderboard returned', type: InstanceLeaderboardResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceLeaderboardResponseDto> {
    return this.instanceService.getLeaderboard(instanceId).then((entries) => ({
      instanceId,
      items: entries.map((e) => this.mapper.toLeaderboardEntryResponse(e)),
    }));
  }
}
