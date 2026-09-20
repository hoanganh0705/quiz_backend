import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  applyDecorators,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { decodeInstancePlayerCursor, decodeLeaderboardCursor } from '@/common/utils/cursor.util';
import { type JwtPayload } from '@/common/guards/jwt.guard';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { InstanceApplicationService } from '../../application/instance.application.service';
import {
  CreateInstanceDto,
  GetInstancePlayersQueryDto,
  GetLeaderboardQueryDto,
  ListInstancesQueryDto,
  StartCountdownDto,
} from '../../dto/request';
import type { LeaderboardCursorPayload } from '../../domain/ports';
import {
  CancelCountdownResponseDto,
  CreateInstanceResponseDto,
  InstanceDetailResponseDto,
  InstanceLeaderboardResponseDto,
  InstanceListResponseDto,
  InstancePlayerResponseDto,
  JoinInstanceResponseDto,
  StartCountdownResponseDto,
  StartInstanceResponseDto,
  CloseInstanceResponseDto,
} from '../../dto/response';
import {
  ApiCreatedResource,
  ApiOkResource,
  ApiOkResourceList,
  ApiAcceptedResource,
} from '@/common/swagger/api-ok';
import { InstancePresenter } from '../presenters/instance.presenter';
import {
  ApiInstanceIdParam,
  InstanceErrorResponseExamples,
} from '../swagger/instance-swagger-decorators';

function instanceNotFoundResponse(): MethodDecorator {
  return applyDecorators(
    ApiNotFoundResponse({
      description:
        'Instance not found. Returned as an RFC 7807 ProblemDetail. ' +
        'Detail: "Quiz instance not found".',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.instanceNotFound,
    }),
  );
}

function instanceForbiddenResponse(): MethodDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Caller is not the host of the instance. Returned as an RFC 7807 ProblemDetail. ' +
        'Detail: "Only the host can perform this action".',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.instanceNotHost,
    }),
  );
}
function instanceBadRequestResponse(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        'Request failed validation OR a domain-level precondition failed. ' +
        'Returned as an RFC 7807 ProblemDetail. Domain errors: ' +
        '`InstanceNotOpenError`, `InstanceFullError`, `InstanceAlreadyStartedError`, ' +
        '`InstanceAlreadyClosedError`.',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.instanceNotOpen,
    }),
  );
}

/**
 * 400 variant for `startInstance` and `closeInstance` paths where the
 * "started" or "closed" codes are the most common outcome.
 */
function instanceStartBadRequestResponse(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        'Domain precondition failed. Returned as an RFC 7807 ProblemDetail. ' +
        'Domain errors: `InstanceAlreadyStartedError`, `InstanceAlreadyClosedError`, ' +
        '`InstanceAlreadyFinishedError`.',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.instanceAlreadyStarted,
    }),
  );
}

/** 401 — globally enforced by JwtGuard. */
function instanceUnauthorizedResponse(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. Returned by the global JwtGuard as an RFC 7807 ProblemDetail. ' +
        'Detail: "Invalid or expired access token" (matches the shared `ErrorResponseExamples.unauthorized`).',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.unauthorized,
    }),
  );
}

function instanceConflictResponse(): MethodDecorator {
  return applyDecorators(
    ApiConflictResponse({
      description:
        'Caller is already a player in the instance. Returned as an RFC 7807 ProblemDetail. ' +
        'Detail: "You have already joined this instance".',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.playerAlreadyJoined,
    }),
  );
}

function instanceUnprocessableEntityResponse(): MethodDecorator {
  return applyDecorators(
    ApiUnprocessableEntityResponse({
      description:
        'Instance does not satisfy the multiplayer precondition. Returned as an RFC 7807 ' +
        'ProblemDetail. Detail: "Instance requires at least 2 players before the host can ' +
        'start the countdown".',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.minPlayersNotMet,
    }),
  );
}

function instanceNotInCountdownResponse(): MethodDecorator {
  return applyDecorators(
    ApiConflictResponse({
      description:
        'Instance is not in the `countdown` state. Returned as an RFC 7807 ProblemDetail. ' +
        'Detail: "Instance is not in the countdown state".',
      type: ProblemDetailDto,
      example: InstanceErrorResponseExamples.instanceNotInCountdown,
    }),
  );
}

@ApiTags('instances')
@Controller('instances')
export class InstanceController {
  constructor(
    private readonly applicationService: InstanceApplicationService,
    private readonly presenter: InstancePresenter,
  ) {}

  @Post()
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiCreatedResource(CreateInstanceResponseDto, { description: 'Instance created' })
  @ApiOperation({
    summary: 'Create instance',
    operationId: 'createInstance',
    description:
      'Creates a new quiz instance for the given quiz, automatically adding the caller as a host player. ' +
      'The latest published version of the quiz is resolved server-side — clients only need to know the `quizId`. ' +
      'Requires a valid JWT bearer token. A 400 is returned only when the request body fails validation ' +
      '(e.g. `quizId` is not a valid UUID or `maxPlayers` is outside 2–100). ' +
      '500 can be returned for unexpected server errors (e.g. database failures).',
  })
  @ApiBadRequestResponse({
    description:
      'Request body failed validation (e.g. invalid `quizId`, invalid `maxPlayers`). ' +
      'RFC 7807 ProblemDetail envelope.',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  async createInstance(@CurrentUser() user: JwtPayload, @Body() payload: CreateInstanceDto) {
    const result = await this.applicationService.createInstanceForController({
      quizId: payload.quizId,
      user,
      maxPlayers: payload.maxPlayers ?? null,
    });
    return this.presenter.createInstance(result);
  }

  @Get()
  @instanceUnauthorizedResponse()
  @ApiOkResourceList(InstanceListResponseDto, 'cursor', { description: 'Instance list returned' })
  @ApiOperation({
    summary: 'List instances',
    operationId: 'listInstances',
    description:
      'Returns a paginated cursor-based list of quiz instances. Requires a valid JWT bearer token. ' +
      'Query parameters: `cursor` (opaque pagination cursor), `limit` (1–100, default 20), ' +
      '`status` (one of `open`, `running`, `closed`, `finished`), `difficulty` (`easy`, `medium`, `hard`), ' +
      '`quizId` (filter by quiz UUID), `creatorId` (filter by host UUID). ' +
      '400 is returned only when the query parameters fail validation.',
  })
  @instanceBadRequestResponse()
  async listInstances(@Query() query: ListInstancesQueryDto) {
    const result = await this.applicationService.listInstancesForController({
      limit: query.limit ?? 20,
      cursor: query.cursor,
      filters: {
        status: query.status,
        difficulty: query.difficulty,
        quizId: query.quizId,
        creatorId: query.creatorId,
      },
    });
    return this.presenter.listInstances(result);
  }

  @Get(':id/players')
  @instanceUnauthorizedResponse()
  @ApiOkResourceList(InstancePlayerResponseDto, 'cursor', { description: 'Players returned' })
  @ApiOperation({
    summary: 'List instance players',
    operationId: 'listInstancePlayers',
    description:
      'Returns the cursor-paginated list of players currently in the instance, sorted by join time. ' +
      'Requires a valid JWT bearer token. Query parameters: `cursor` (opaque pagination cursor, ' +
      'decoded payload: `{ joinedAt, instancePlayerId }`) and `limit` (1–100, default 20). ' +
      '404 is returned when the instance does not exist.',
  })
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async listInstancePlayers(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @Query() query: GetInstancePlayersQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursor: { joinedAt: string; instancePlayerId: string } | undefined = query.cursor
      ? decodeInstancePlayerCursor(query.cursor)
      : undefined;
    const result = await this.applicationService.listInstancePlayersForController({
      instanceId,
      limit,
      cursor: cursor ?? null,
    });
    return this.presenter.listInstancePlayers(result);
  }

  @Get(':id')
  @instanceUnauthorizedResponse()
  @ApiOkResource(InstanceDetailResponseDto, { description: 'Instance found' })
  @ApiOperation({
    summary: 'Get instance by id',
    operationId: 'getInstanceById',
    description:
      'Returns full instance details including the host, quiz info, lifecycle timestamps, ' +
      'and a snapshot of the current players. Requires a valid JWT bearer token. ' +
      '404 is returned when the instance does not exist.',
  })
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async getInstanceById(@Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string) {
    const result = await this.applicationService.getInstanceByIdForController(instanceId);
    return this.presenter.getInstanceById(result);
  }

  @Post(':id/join')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiCreatedResource(JoinInstanceResponseDto, { description: 'Joined successfully' })
  @instanceConflictResponse()
  @ApiOperation({
    summary: 'Join instance',
    operationId: 'joinInstance',
    description:
      'Adds the caller as a player in the instance. Requires a valid JWT bearer token. ' +
      'Possible errors: 400 (instance is not open, instance is at capacity, malformed path UUID, ' +
      'or body validation failure), 404 (instance does not exist), and 409 (caller is already a ' +
      'player in the instance). Returns 201 with `{ message: "Joined the instance successfully" }`.',
  })
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async joinInstance(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.joinInstanceForController(instanceId, user);
    return this.presenter.joinInstance(result);
  }

  @Post(':id/start')
  @instanceUnauthorizedResponse()
  @ApiAcceptedResource(StartInstanceResponseDto, { description: 'Instance started' })
  @ApiOperation({
    summary: 'Start instance',
    operationId: 'startInstance',
    description:
      'Transitions a `countdown` instance into the `running` state. Only the host can start an instance. ' +
      'Requires a valid JWT bearer token. Possible errors: 400 (instance is already `running` ' +
      '(`INSTANCE_ALREADY_STARTED`) or already terminal `closed`/`finished` ' +
      '(`INSTANCE_ALREADY_CLOSED`)), 403 (caller is not the host), ' +
      '404 (instance does not exist), 409 (instance is still in `open` and the countdown has ' +
      'not been started — `INSTANCE_NOT_IN_COUNTDOWN`), and 422 (fewer than 2 players joined — ' +
      '`MIN_PLAYERS_NOT_MET`). Returns 202 with `{ message: "Instance started" }`.',
  })
  @instanceStartBadRequestResponse()
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  @instanceNotInCountdownResponse()
  @instanceUnprocessableEntityResponse()
  @ApiInstanceIdParam()
  async startInstance(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.startInstanceForController(instanceId, user);
    return this.presenter.startInstance(result);
  }

  @Post(':id/close')
  @instanceUnauthorizedResponse()
  @ApiAcceptedResource(CloseInstanceResponseDto, { description: 'Instance closed' })
  @ApiOperation({
    summary: 'Close instance',
    operationId: 'closeInstance',
    description:
      'Transitions the instance into the `closed` state. Only the host can close an instance. ' +
      'Requires a valid JWT bearer token. Possible errors: 400 (instance is already closed ' +
      '(`INSTANCE_ALREADY_CLOSED`) or already finished (`INSTANCE_ALREADY_FINISHED`), ' +
      'or malformed path UUID), 403 (caller is not the host), 404 (instance does not exist). ' +
      'Returns 202 with `{ message: "Instance closed" }`.',
  })
  @instanceStartBadRequestResponse()
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async closeInstance(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.closeInstanceForController(instanceId, user);
    return this.presenter.closeInstance(result);
  }

  @Post(':id/countdown')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiOkResource(StartCountdownResponseDto, { description: 'Countdown started' })
  @ApiOperation({
    summary: 'Start countdown',
    operationId: 'startCountdown',
    description:
      'Transitions an open instance into the `countdown` state. Only the host can start the countdown. ' +
      'Persists `countdownStartedAt` and emits the `countdown_started` WebSocket event. ' +
      'Idempotent: a retry of the same call returns the existing anchor. Requires a valid JWT bearer token. ' +
      'Possible errors: 400 (instance is not open), 403 (caller is not the host), ' +
      '404 (instance does not exist).',
  })
  @instanceBadRequestResponse()
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async startCountdown(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: StartCountdownDto,
  ) {
    if (payload.idempotencyKey) {
      this.applicationService.logCountdownIdempotencyKey({
        instanceId,
        userId: user.sub,
        idempotencyKey: payload.idempotencyKey,
      });
    }
    const result = await this.applicationService.startCountdownForController(instanceId, user);
    return this.presenter.startCountdown(result);
  }

  @Post(':id/countdown/cancel')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiAcceptedResource(CancelCountdownResponseDto, { description: 'Countdown cancelled' })
  @ApiOperation({
    summary: 'Cancel countdown',
    operationId: 'cancelCountdown',
    description:
      'Transitions an instance in the `countdown` state back to `open`. Only the host can cancel. ' +
      'Emits the `countdown_cancelled` WebSocket event. Requires a valid JWT bearer token. ' +
      'Possible errors: 403 (caller is not the host), 404 (instance does not exist), ' +
      '409 (instance is not in the `countdown` state).',
  })
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  @instanceNotInCountdownResponse()
  @ApiInstanceIdParam()
  async cancelCountdown(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.cancelCountdownForController(instanceId, user);
    return this.presenter.cancelCountdown(result);
  }

  @Get(':id/leaderboard')
  @instanceUnauthorizedResponse()
  @ApiOkResourceList(InstanceLeaderboardResponseDto, 'cursor', {
    description: 'Leaderboard returned',
  })
  @ApiOperation({
    summary: 'Get instance leaderboard',
    operationId: 'getInstanceLeaderboard',
    description:
      'Returns the ranked player leaderboard for the instance, sorted by attempt score then ' +
      'by completion time. Requires a valid JWT bearer token. ' +
      'Supports cursor pagination via the `cursor` query parameter (decoded payload: ' +
      '`{ rank, instancePlayerId }`) and `limit` (1–100, default 20). ' +
      '404 is returned when the instance does not exist.',
  })
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async getLeaderboard(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @Query() query: GetLeaderboardQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursor: LeaderboardCursorPayload | undefined = query.cursor
      ? decodeLeaderboardCursor(query.cursor)
      : undefined;

    const result = await this.applicationService.getLeaderboardForController({
      instanceId,
      limit,
      cursor: cursor ?? null,
    });
    return this.presenter.getLeaderboard(result);
  }
}
