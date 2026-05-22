import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
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

@Controller('instances')
@UseFilters(InstanceDomainExceptionFilter)
export class InstanceController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly mapper: InstanceResponseMapper,
  ) {}

  @Post()
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
  getInstanceById(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceDetailResponseDto> {
    return this.instanceService.getInstanceById(instanceId).then((row) => {
      return this.mapper.toInstanceDetailResponse(row, []);
    });
  }

  @Post(':id/join')
  joinInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JoinInstanceResponseDto> {
    return this.instanceService.joinInstance(instanceId, user);
  }

  @Post(':id/start')
  startInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartInstanceResponseDto> {
    return this.instanceService.startInstance(instanceId, user);
  }

  @Post(':id/close')
  closeInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CloseInstanceResponseDto> {
    return this.instanceService.closeInstance(instanceId, user);
  }

  @Get(':id/leaderboard')
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceLeaderboardResponseDto> {
    return this.instanceService.getLeaderboard(instanceId).then((entries) => ({
      instanceId,
      items: entries.map((e) => this.mapper.toLeaderboardEntryResponse(e)),
    }));
  }
}
