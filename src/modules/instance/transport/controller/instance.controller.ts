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
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import {
  ApiAuthAction,
  ApiAuthCreateWithState,
  ApiPublicRead,
} from '@/common/swagger/swagger-decorators';
import { decodeBase64JsonCursor } from '@/common/utils/cursor.util';
import { type JwtPayload } from '@/common/guards/jwt.guard';
import { InstanceService } from '../../domain/instance.service';
import { InstanceResponseMapper } from '../../mappers/instance-response.mapper';
import {
  CreateInstanceDto,
  GetLeaderboardQueryDto,
  ListInstancesQueryDto,
} from '../../dto/request';
import type { LeaderboardCursorPayload } from '../../domain/ports';
import {
  CreateInstanceResponseDto,
  InstanceDetailResponseDto,
  JoinInstanceResponseDto,
  StartInstanceResponseDto,
  CloseInstanceResponseDto,
  InstanceLeaderboardResponseDto,
  InstanceListResponseDto,
  InstancePlayersResponseDto,
} from '../../dto/response';
import {
  WrappedCreateInstanceResponseDto,
  WrappedInstanceDetailResponseDto,
  WrappedJoinInstanceResponseDto,
  WrappedStartInstanceResponseDto,
  WrappedCloseInstanceResponseDto,
  WrappedInstanceListResponseDto,
  WrappedInstanceLeaderboardResponseDto,
  WrappedInstancePlayersResponseDto,
} from '../../dto/response';
import { InstanceDomainExceptionFilter } from '../filters/instance-domain-exception.filter';

@ApiTags('instances')
@Controller('instances')
@UseFilters(InstanceDomainExceptionFilter)
export class InstanceController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly mapper: InstanceResponseMapper,
  ) {}

  @Post()
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiAuthCreateWithState({
    description: 'Instance created',
    type: WrappedCreateInstanceResponseDto,
  })
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

  @Get()
  @ApiPublicRead({ description: 'Instance list returned', type: WrappedInstanceListResponseDto })
  async listInstances(@Query() query: ListInstancesQueryDto): Promise<InstanceListResponseDto> {
    const result = await this.instanceService.listInstances({
      limit: query.limit ?? 20,
      cursor: query.cursor,
      filters: {
        status: query.status,
        difficulty: query.difficulty,
      },
    });

    return {
      items: result.rows.map((row) => this.mapper.toInstanceListItemResponse(row)),
      pagination: {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        nextCursor: result.nextCursor,
      },
    };
  }

  @Get(':id/players')
  @ApiPublicRead({ description: 'Players returned', type: WrappedInstancePlayersResponseDto })
  async listInstancePlayers(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstancePlayersResponseDto> {
    const { items, total } = await this.instanceService.listInstancePlayers(instanceId);

    return {
      instanceId,
      items: items.map((p) => this.mapper.toInstancePlayerResponse(p)),
      total,
    };
  }

  @Get(':id')
  @ApiPublicRead({ description: 'Instance found', type: WrappedInstanceDetailResponseDto })
  getInstanceById(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
  ): Promise<InstanceDetailResponseDto> {
    return this.instanceService.getInstanceById(instanceId).then(async (row) => {
      const { items: players } = await this.instanceService.listInstancePlayers(instanceId);
      return this.mapper.toInstanceDetailResponse(
        row,
        players.map((p) => this.mapper.toInstancePlayerResponse(p)),
      );
    });
  }

  @Post(':id/join')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiAuthAction({
    description: 'Joined successfully',
    type: WrappedJoinInstanceResponseDto,
  })
  async joinInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JoinInstanceResponseDto> {
    return this.instanceService.joinInstance(instanceId, user);
  }

  @Post(':id/start')
  @ApiAuthAction({
    description: 'Instance started',
    type: WrappedStartInstanceResponseDto,
  })
  async startInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartInstanceResponseDto> {
    return this.instanceService.startInstance(instanceId, user);
  }

  @Post(':id/close')
  @ApiAuthAction({
    description: 'Instance closed',
    type: WrappedCloseInstanceResponseDto,
  })
  async closeInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CloseInstanceResponseDto> {
    return this.instanceService.closeInstance(instanceId, user);
  }

  @Get(':id/leaderboard')
  @ApiPublicRead({
    description: 'Leaderboard returned',
    type: WrappedInstanceLeaderboardResponseDto,
  })
  getLeaderboard(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @Query() query: GetLeaderboardQueryDto,
  ): Promise<InstanceLeaderboardResponseDto> {
    const limit = query.limit ?? 20;
    const cursor: LeaderboardCursorPayload | undefined = query.cursor
      ? (decodeBase64JsonCursor<LeaderboardCursorPayload>(query.cursor) as LeaderboardCursorPayload)
      : undefined;

    return this.instanceService
      .getLeaderboard({ instanceId, limit, cursor: cursor ?? null })
      .then(({ items, hasNextPage }) => {
        const lastItem = items[items.length - 1];
        const nextCursor =
          hasNextPage && lastItem
            ? Buffer.from(
                JSON.stringify({
                  rank: lastItem.rank,
                  instancePlayerId: lastItem.instancePlayerId,
                }),
                'utf8',
              ).toString('base64url')
            : null;

        return {
          items: items.map((e) => this.mapper.toLeaderboardEntryResponse(e)),
          hasNextPage,
          nextCursor,
        };
      });
  }
}
