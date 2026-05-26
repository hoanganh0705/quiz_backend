import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
  @ApiOperation({
    summary: 'Create instance',
    description: 'Creates a new live quiz instance and sets the authenticated user as the host.',
  })
  @ApiCreatedResponse({ description: 'Instance created', type: CreateInstanceResponseDto })
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
  getInstanceById(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceDetailResponseDto> {
    return this.instanceService.getInstanceById(instanceId).then((row) => {
      return this.mapper.toInstanceDetailResponse(row, []);
    });
  }

  @Post(':id/join')
  @ApiOperation({
    summary: 'Join instance',
    description: 'Adds the authenticated user as a player in the instance.',
  })
  @ApiOkResponse({ description: 'Joined successfully', type: JoinInstanceResponseDto })
  joinInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JoinInstanceResponseDto> {
    return this.instanceService.joinInstance(instanceId, user);
  }

  @Post(':id/start')
  @ApiOperation({
    summary: 'Start instance',
    description: 'Starts the instance, allowing all joined players to begin answering questions.',
  })
  @ApiOkResponse({ description: 'Instance started', type: StartInstanceResponseDto })
  startInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartInstanceResponseDto> {
    return this.instanceService.startInstance(instanceId, user);
  }

  @Post(':id/close')
  @ApiOperation({
    summary: 'Close instance',
    description: 'Closes the instance and finalizes all player scores.',
  })
  @ApiOkResponse({ description: 'Instance closed', type: CloseInstanceResponseDto })
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
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceLeaderboardResponseDto> {
    return this.instanceService.getLeaderboard(instanceId).then((entries) => ({
      instanceId,
      items: entries.map((e) => this.mapper.toLeaderboardEntryResponse(e)),
    }));
  }
}
