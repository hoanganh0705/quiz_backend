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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import {
  ApiAuth,
  ApiAuthAction,
  ApiBadRequest,
  ApiInternalError,
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
  InstanceDetailResponseDto,
  CreateInstanceResponseDto,
  JoinInstanceResponseDto,
  StartInstanceResponseDto,
  CloseInstanceResponseDto,
  InstanceLeaderboardResponseDto,
  InstanceListResponseDto,
  InstancePlayersResponseDto,
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
  @ApiAuth()
  @ApiOperation({
    summary: 'Create instance',
    description: 'Creates a new live quiz instance and sets the authenticated user as the host.',
  })
  @ApiCreatedResponse({ description: 'Instance created', type: CreateInstanceResponseDto })
  @ApiNotFoundResponse({ description: 'Quiz version not found' })
  @ApiForbiddenResponse({
    description: 'You do not have permission to create an instance for this quiz',
  })
  @ApiBadRequest('Validation failed')
  @ApiInternalError()
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
  @ApiOperation({
    summary: 'List open instances',
    description:
      'Returns a paginated, cursor-based list of open quiz instances for discovery. ' +
      'Only instances with status `open` are returned by default.',
  })
  @ApiOkResponse({ description: 'Instance list returned', type: InstanceListResponseDto })
  @ApiInternalError()
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
  @ApiOperation({
    summary: 'List instance players',
    description: 'Returns all players in a specific instance, with profile data.',
  })
  @ApiOkResponse({ description: 'Players returned', type: InstancePlayersResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiInternalError()
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
  @ApiOperation({
    summary: 'Get instance by ID',
    description: 'Returns the full instance record including current players.',
  })
  @ApiOkResponse({ description: 'Instance found', type: InstanceDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  @ApiInternalError()
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
  @ApiAuthAction({ description: 'Joined successfully', type: JoinInstanceResponseDto })
  async joinInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JoinInstanceResponseDto> {
    return this.instanceService.joinInstance(instanceId, user);
  }

  @Post(':id/start')
  @ApiAuthAction({ description: 'Instance started', type: StartInstanceResponseDto })
  async startInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StartInstanceResponseDto> {
    return this.instanceService.startInstance(instanceId, user);
  }

  @Post(':id/close')
  @ApiAuthAction({ description: 'Instance closed', type: CloseInstanceResponseDto })
  async closeInstance(
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
  @ApiInternalError()
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
          instanceId,
          items: items.map((e) => this.mapper.toLeaderboardEntryResponse(e)),
          hasNextPage,
          nextCursor,
        };
      });
  }
}
