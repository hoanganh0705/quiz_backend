import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  applyDecorators,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { decodeBase64JsonCursor } from '@/common/utils/cursor.util';
import { type JwtPayload } from '@/common/guards/jwt.guard';
import { AUTH_SECURITY_NAME } from '@/core/swagger/swagger.config';
import { InstanceApplicationService } from '../../application/instance.application.service';
import {
  CreateInstanceDto,
  GetLeaderboardQueryDto,
  ListInstancesQueryDto,
} from '../../dto/request';
import type { LeaderboardCursorPayload } from '../../domain/ports';
import {
  CreateInstanceResponseDto,
  InstanceDetailResponseDto,
  InstanceLeaderboardResponseDto,
  InstanceListResponseDto,
  InstancePlayersResponseDto,
  JoinInstanceResponseDto,
  StartInstanceResponseDto,
  CloseInstanceResponseDto,
  InstanceDomainErrorDto,
} from '../../dto/response';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { InstanceDomainExceptionFilter } from '../filters/instance-domain-exception.filter';
import { InstancePresenter } from '../presenters/instance.presenter';

// ─── Local helper decorators ───────────────────────────────────────────────────
//
// `InstanceDomainExceptionFilter` rewrites every `InstanceDomainError` into
// `{ statusCode, message, error }` (NOT RFC 7807), so we need:
//   404 / 403 / 400 / 409 — InstanceDomainErrorDto shape (from the domain filter).
//   401 / 400 (validator) / 400 (ParseUUIDPipe) — ProblemDetailDto (from GlobalExceptionFilter).
//
// When the same HTTP status can originate from BOTH filters we use `schema.oneOf`.

/** 404 thrown by `InstanceService` → handled by InstanceDomainExceptionFilter. */
function instanceNotFoundResponse(): MethodDecorator {
  return applyDecorators(
    ApiNotFoundResponse({
      description:
        'Instance not found. Returned by the instance domain exception filter with a ' +
        '`{ statusCode, message, error }` envelope (message is always "Resource not found").',
      schema: { $ref: getSchemaPath(InstanceDomainErrorDto) },
    }),
  );
}

/** 403 from `InstanceNotHostError` (domain) → InstanceDomainExceptionFilter. */
function instanceForbiddenResponse(): MethodDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Caller is not the host of the instance. Returned by the instance domain exception filter ' +
        'with a `{ statusCode, message, error }` envelope ' +
        '(message is always "You do not have permission to perform this action").',
      schema: { $ref: getSchemaPath(InstanceDomainErrorDto) },
    }),
  );
}

/**
 * 400 that can be either:
 *   - `ProblemDetailDto` from `GlobalExceptionFilter` (class-validator on body, ParseUUIDPipe on path, etc.)
 *   - `InstanceDomainErrorDto` from `InstanceDomainExceptionFilter` (InstanceNotOpenError, InstanceFullError,
 *     InstanceAlreadyStartedError, InstanceAlreadyClosedError).
 */
function instanceBadRequestResponseDual(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        'Request failed validation OR a domain-level precondition failed. The response is either ' +
        'an RFC 7807 `ProblemDetailDto` (from class-validator on the body / ParseUUIDPipe on the path) ' +
        'or an `InstanceDomainErrorDto` envelope from the instance domain exception filter ' +
        '(`InstanceNotOpenError`, `InstanceFullError`, `InstanceAlreadyStartedError`, ' +
        '`InstanceAlreadyClosedError` all map to 400 with the generic message "Invalid request data").',
      schema: {
        oneOf: [
          { $ref: getSchemaPath(ProblemDetailDto) },
          { $ref: getSchemaPath(InstanceDomainErrorDto) },
        ],
      },
    }),
  );
}

/** 400 from `ParseUUIDPipe` / query-param validation only — not domain. */
function instanceBadRequestResponseValidation(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        'Request failed validation (e.g. malformed UUID in the path or invalid query parameters). ' +
        'RFC 7807 ProblemDetail envelope.',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.badRequest,
    }),
  );
}

/** 401 — globally enforced by JwtGuard. */
function instanceUnauthorizedResponse(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(AUTH_SECURITY_NAME),
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. Returned by the global JwtGuard as an RFC 7807 ProblemDetail.',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.unauthorized,
    }),
  );
}

@ApiTags('instances')
@ApiExtraModels(ProblemDetailDto, InstanceDomainErrorDto)
@Controller('instances')
@UseFilters(InstanceDomainExceptionFilter)
export class InstanceController {
  constructor(
    private readonly applicationService: InstanceApplicationService,
    private readonly presenter: InstancePresenter,
  ) {}

  // ─── POST /instances ────────────────────────────────────────────────────────
  //
  // `instanceService.createInstance` only inserts a row — it never throws any
  // `InstanceDomainError`. The only 400 path is class-validator on the body
  // (handled by GlobalExceptionFilter → ProblemDetailDto).
  @Post()
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiCreatedResource(CreateInstanceResponseDto, { description: 'Instance created' })
  @ApiOperation({
    summary: 'Create instance',
    description:
      'Creates a new quiz instance for the given published quiz version and automatically ' +
      'adds the caller as a host player. Requires a valid JWT bearer token. ' +
      'A 400 is returned only when the request body fails validation ' +
      '(e.g. `quizVersionId` is not a valid UUID or `maxPlayers` is outside 2–100). ' +
      '500 can be returned for unexpected server errors (e.g. database failures).',
  })
  @ApiBadRequestResponse({
    description:
      'Request body failed validation (e.g. invalid `quizVersionId`, invalid `maxPlayers`). ' +
      'RFC 7807 ProblemDetail envelope.',
    type: ProblemDetailDto,
    example: ErrorResponseExamples.badRequest,
  })
  async createInstance(@CurrentUser() user: JwtPayload, @Body() payload: CreateInstanceDto) {
    const result = await this.applicationService.createInstanceForController({
      quizVersionId: payload.quizVersionId,
      user,
      maxPlayers: payload.maxPlayers ?? null,
    });
    return this.presenter.createInstance(result);
  }

  // ─── GET /instances ─────────────────────────────────────────────────────────
  //
  // Global JwtGuard enforces authentication even though the endpoint is public
  // by design. 404 cannot occur (list endpoint).
  @Get()
  @instanceUnauthorizedResponse()
  @ApiOkResourceList(InstanceListResponseDto, 'cursor', { description: 'Instance list returned' })
  @ApiOperation({
    summary: 'List instances',
    description:
      'Returns a paginated cursor-based list of quiz instances. Requires a valid JWT bearer token. ' +
      'Query parameters: `cursor` (opaque pagination cursor), `limit` (1–100, default 20), ' +
      '`status` (one of `open`, `running`, `closed`, `finished`), `difficulty` (`easy`, `medium`, `hard`). ' +
      '400 is returned only when the query parameters fail validation.',
  })
  @instanceBadRequestResponseValidation()
  async listInstances(@Query() query: ListInstancesQueryDto) {
    const result = await this.applicationService.listInstancesForController({
      limit: query.limit ?? 20,
      cursor: query.cursor,
      filters: {
        status: query.status,
        difficulty: query.difficulty,
      },
    });
    return this.presenter.listInstances(result);
  }

  // ─── GET /instances/{id}/players ────────────────────────────────────────────
  //
  // `InstanceService.listInstancePlayers` throws `InstanceNotFoundError` when
  // the instance does not exist → InstanceDomainExceptionFilter → 404.
  // The response payload (`{ instanceId, items, total }`) does NOT contain a
  // `pagination` key, so the envelope wraps it as a non-paginated resource.
  @Get(':id/players')
  @instanceUnauthorizedResponse()
  @ApiOkResource(InstancePlayersResponseDto, { description: 'Players returned' })
  @ApiOperation({
    summary: 'List instance players',
    description:
      'Returns the list of players currently in the instance, with a `total` count. ' +
      'Requires a valid JWT bearer token. 404 is returned when the instance does not exist.',
  })
  @instanceBadRequestResponseValidation()
  @instanceNotFoundResponse()
  async listInstancePlayers(@Param('id', new ParseUUIDPipe()) instanceId: string) {
    const result = await this.applicationService.listInstancePlayersForController(instanceId);
    return this.presenter.listInstancePlayers(result);
  }

  // ─── GET /instances/{id} ────────────────────────────────────────────────────
  //
  // `InstanceService.getInstanceById` throws `InstanceNotFoundError` on miss
  // → 404 via `InstanceDomainExceptionFilter`.
  @Get(':id')
  @instanceUnauthorizedResponse()
  @ApiOkResource(InstanceDetailResponseDto, { description: 'Instance found' })
  @ApiOperation({
    summary: 'Get instance by id',
    description:
      'Returns full instance details including the host, quiz info, lifecycle timestamps, ' +
      'and a snapshot of the current players. Requires a valid JWT bearer token. ' +
      '404 is returned when the instance does not exist.',
  })
  @instanceBadRequestResponseValidation()
  @instanceNotFoundResponse()
  async getInstanceById(@Param('id', new ParseUUIDPipe()) instanceId: string) {
    const result = await this.applicationService.getInstanceByIdForController(instanceId);
    return this.presenter.getInstanceById(result);
  }

  // ─── POST /instances/{id}/join ─────────────────────────────────────────────
  //
  // `InstanceService.joinInstance` throws:
  //   - `InstanceNotFoundError` → 404 InstanceDomainErrorDto
  //   - `InstanceNotOpenError`  → 400 InstanceDomainErrorDto
  //   - `InstanceFullError`     → 400 InstanceDomainErrorDto
  // Note: 403 (host check) and 409 (conflict) are NEVER thrown here.
  // 400 can also come from class-validator / ParseUUIDPipe → ProblemDetailDto.
  @Post(':id/join')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiOkResource(JoinInstanceResponseDto, { description: 'Joined successfully' })
  @ApiOperation({
    summary: 'Join instance',
    description:
      'Adds the caller as a player in the instance. Requires a valid JWT bearer token. ' +
      'Possible errors: 400 (instance is not open, instance is full, malformed path UUID, ' +
      'or body validation failure) and 404 (instance does not exist). ' +
      'Returns 200 with `{ message: "Joined the instance successfully" }`.',
  })
  @instanceBadRequestResponseDual()
  @instanceNotFoundResponse()
  async joinInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.joinInstanceForController(instanceId, user);
    return this.presenter.joinInstance(result);
  }

  // ─── POST /instances/{id}/start ─────────────────────────────────────────────
  //
  // `InstanceService.startInstance` throws:
  //   - `InstanceNotFoundError`        → 404 InstanceDomainErrorDto
  //   - `InstanceNotHostError`         → 403 InstanceDomainErrorDto
  //   - `InstanceAlreadyStartedError`  → 400 InstanceDomainErrorDto
  // 409 is NEVER thrown here.
  @Post(':id/start')
  @instanceUnauthorizedResponse()
  @ApiOkResource(StartInstanceResponseDto, { description: 'Instance started' })
  @ApiOperation({
    summary: 'Start instance',
    description:
      'Transitions an open instance into the `running` state. Only the host can start an instance. ' +
      'Requires a valid JWT bearer token. Possible errors: 400 (instance has already started, ' +
      'or malformed path UUID), 403 (caller is not the host), 404 (instance does not exist). ' +
      'Returns 200 with `{ message: "Instance started" }`.',
  })
  @instanceBadRequestResponseDual()
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  async startInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.startInstanceForController(instanceId, user);
    return this.presenter.startInstance(result);
  }

  // ─── POST /instances/{id}/close ────────────────────────────────────────────
  //
  // `InstanceService.closeInstance` throws:
  //   - `InstanceNotFoundError`        → 404 InstanceDomainErrorDto
  //   - `InstanceNotHostError`         → 403 InstanceDomainErrorDto
  //   - `InstanceAlreadyClosedError`   → 400 InstanceDomainErrorDto
  // 409 is NEVER thrown here.
  @Post(':id/close')
  @instanceUnauthorizedResponse()
  @ApiOkResource(CloseInstanceResponseDto, { description: 'Instance closed' })
  @ApiOperation({
    summary: 'Close instance',
    description:
      'Transitions the instance into the `closed` state. Only the host can close an instance. ' +
      'Requires a valid JWT bearer token. Possible errors: 400 (instance is already closed, ' +
      'or malformed path UUID), 403 (caller is not the host), 404 (instance does not exist). ' +
      'Returns 200 with `{ message: "Instance closed" }`.',
  })
  @instanceBadRequestResponseDual()
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  async closeInstance(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.closeInstanceForController(instanceId, user);
    return this.presenter.closeInstance(result);
  }

  // ─── GET /instances/{id}/leaderboard ───────────────────────────────────────
  //
  // `InstanceService.getLeaderboard` throws `InstanceNotFoundError` on miss → 404.
  // The application service projects the leaderboard into the canonical cursor
  // pagination shape `{ items, pagination: { limit, hasNextPage, nextCursor } }`,
  // so the envelope contains a `pagination` block — the legacy "D-variant"
  // (where `pagination` was hoisted up to `data`) is no longer used.
  @Get(':id/leaderboard')
  @instanceUnauthorizedResponse()
  @ApiOkResourceList(InstanceLeaderboardResponseDto, 'cursor', {
    description: 'Leaderboard returned',
  })
  @ApiOperation({
    summary: 'Get instance leaderboard',
    description:
      'Returns the ranked player leaderboard for the instance, sorted by attempt score then ' +
      'by completion time. Requires a valid JWT bearer token. ' +
      'Supports cursor pagination via the `cursor` query parameter (decoded payload: ' +
      '`{ rank, instancePlayerId }`) and `limit` (1–100, default 20). ' +
      '404 is returned when the instance does not exist.',
  })
  @instanceBadRequestResponseValidation()
  @instanceNotFoundResponse()
  async getLeaderboard(
    @Param('id', new ParseUUIDPipe()) instanceId: string,
    @Query() query: GetLeaderboardQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursor: LeaderboardCursorPayload | undefined = query.cursor
      ? (decodeBase64JsonCursor<LeaderboardCursorPayload>(query.cursor) as LeaderboardCursorPayload)
      : undefined;

    const result = await this.applicationService.getLeaderboardForController({
      instanceId,
      limit,
      cursor: cursor ?? null,
    });
    return this.presenter.getLeaderboard(result);
  }
}
