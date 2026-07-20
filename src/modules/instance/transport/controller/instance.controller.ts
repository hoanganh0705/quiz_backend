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
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Transactional } from '@/common/interceptors/transactional.interceptor';
import { ProblemDetailDto, ErrorResponseExamples } from '@/common/swagger/swagger-schemas';
import { decodeLeaderboardCursor } from '@/common/utils/cursor.util';
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
} from '../../dto/response';
import { ApiCreatedResource, ApiOkResource, ApiOkResourceList } from '@/common/swagger/api-ok';
import { InstancePresenter } from '../presenters/instance.presenter';
import {
  ApiInstanceIdParam,
  InstanceErrorResponseExamples,
} from '../swagger/instance-swagger-decorators';

// ─── Local helper decorators ───────────────────────────────────────────────────
//
// After Phase 2: every error response is emitted by GlobalExceptionFilter as
// RFC 7807 `ProblemDetailDto` — there is no longer a domain-filtered
// `{ statusCode, message, error }` envelope. So:
//   - 401 / 400 (validator) / 400 (ParseUUIDPipe) → ProblemDetailDto
//   - 400 / 403 / 404 / 409 (domain)                → ProblemDetailDto
//
// The previous `schema.oneOf([ProblemDetailDto, InstanceDomainErrorDto])`
// for the dual-400 helper is no longer needed: every error response is
// uniform RFC 7807 now.
//
// Phase 4 (audit issue 3.2): all error examples now point to the
// per-module `InstanceErrorResponseExamples` payloads so the wire shape
// in the OpenAPI artifact matches the runtime RFC 7807 detail (no more
// generic "The requested resource was not found" / `/quizzes/…`
// `instance` URIs leaking from the shared examples).

/** 404 from `InstanceNotFoundError` (domain) → GlobalExceptionFilter. */
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

/** 403 from `InstanceNotHostError` (domain) → GlobalExceptionFilter. */
function instanceForbiddenResponse(): MethodDecorator {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        'Caller is not the host of the instance. Returned as an RFC 7807 ProblemDetail. ' +
        'Detail: "Only the host can perform this action".',
      type: ProblemDetailDto,
      // Phase 4 (audit issue 6.3): 403 example now matches the
      // `INSTANCE_NOT_HOST` runtime detail (was the generic "You do
      // not have permission..." string in the shared example).
      example: InstanceErrorResponseExamples.instanceNotHost,
    }),
  );
}

/**
 * 400 that can be either class-validator / ParseUUIDPipe validation or a
 * domain-level precondition failure (InstanceNotOpenError, InstanceFullError,
 * InstanceAlreadyStartedError, InstanceAlreadyClosedError). All are emitted
 * as RFC 7807 ProblemDetail by GlobalExceptionFilter after Phase 2.
 *
 * The example payload uses `INSTANCE_NOT_OPEN` since that is the most
 * common 400 domain path on `POST /instances/{id}/join`.
 */
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
    // Phase 4 (audit issue 1.4): the JwtGuard's runtime `detail`
    // matches the shared `unauthorized` example verbatim, so we keep
    // the shared example but document the equivalence in the
    // description. See `swagger-schemas.ts` for the canonical entry.
    ApiUnauthorizedResponse({
      description:
        'Missing or invalid JWT bearer token. Returned by the global JwtGuard as an RFC 7807 ProblemDetail. ' +
        'Detail: "Invalid or expired access token" (matches the shared `ErrorResponseExamples.unauthorized`).',
      type: ProblemDetailDto,
      example: ErrorResponseExamples.unauthorized,
    }),
  );
}

/** 409 from `PlayerAlreadyJoinedError` (Phase 2 — duplicate join). */
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

@ApiTags('instances')
@Controller('instances')
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
  //
  // Phase 4 (audit issue 2.3): the `limit` default is documented in
  // `ListInstancesQueryDto` via `@ApiPropertyOptional({ default: 20 })`.
  // Phase 4 (audit issue 2.9): the cursor payload is base64- (not
  // base64url-) encoded; the DTO docstring above the `cursor` field
  // spells that out so generated SDKs decode correctly.
  @Get()
  @instanceUnauthorizedResponse()
  @ApiOkResourceList(InstanceListResponseDto, 'cursor', { description: 'Instance list returned' })
  @ApiOperation({
    summary: 'List instances',
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

  // ─── GET /instances/{id}/players ────────────────────────────────────────────
  //
  // `InstanceService.listInstancePlayers` throws `InstanceNotFoundError` when
  // the instance does not exist → GlobalExceptionFilter → 404.
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
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async listInstancePlayers(@Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string) {
    const result = await this.applicationService.listInstancePlayersForController(instanceId);
    return this.presenter.listInstancePlayers(result);
  }

  // ─── GET /instances/{id} ────────────────────────────────────────────────────
  //
  // `InstanceService.getInstanceById` throws `InstanceNotFoundError` on miss
  // → 404 via `GlobalExceptionFilter`.
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
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async getInstanceById(@Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string) {
    const result = await this.applicationService.getInstanceByIdForController(instanceId);
    return this.presenter.getInstanceById(result);
  }

  // ─── POST /instances/{id}/join ─────────────────────────────────────────────
  //
  // `InstanceService.joinInstance` throws:
  //   - `InstanceNotFoundError`     → 404 ProblemDetail
  //   - `InstanceNotOpenError`      → 400 ProblemDetail
  //   - `InstanceFullError`         → 400 ProblemDetail (instance at capacity)
  //   - `PlayerAlreadyJoinedError` → 409 ProblemDetail (duplicate join — Phase 2)
  // Note: 403 (host check) is NEVER thrown here.
  // 400 can also come from class-validator / ParseUUIDPipe → ProblemDetail.
  @Post(':id/join')
  @Transactional()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @instanceUnauthorizedResponse()
  @ApiOkResource(JoinInstanceResponseDto, { description: 'Joined successfully' })
  @instanceConflictResponse()
  @ApiOperation({
    summary: 'Join instance',
    description:
      'Adds the caller as a player in the instance. Requires a valid JWT bearer token. ' +
      'Possible errors: 400 (instance is not open, instance is at capacity, malformed path UUID, ' +
      'or body validation failure), 404 (instance does not exist), and 409 (caller is already a ' +
      'player in the instance). Returns 200 with `{ message: "Joined the instance successfully" }`.',
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

  // ─── POST /instances/{id}/start ─────────────────────────────────────────────
  //
  // `InstanceService.startInstance` throws (Phase 3 — issue 6.1):
  //   - `InstanceNotFoundError`        → 404 ProblemDetail
  //   - `InstanceNotHostError`         → 403 ProblemDetail
  //   - `InstanceAlreadyStartedError`  → 400 ProblemDetail  (status = 'running')
  //   - `InstanceAlreadyClosedError`   → 400 ProblemDetail  (status = 'closed'/'finished')
  // 409 is NEVER thrown here.
  @Post(':id/start')
  @instanceUnauthorizedResponse()
  @ApiOkResource(StartInstanceResponseDto, { description: 'Instance started' })
  @ApiOperation({
    summary: 'Start instance',
    description:
      'Transitions an open instance into the `running` state. Only the host can start an instance. ' +
      'Requires a valid JWT bearer token. Possible errors: 400 (instance is already in a non-open ' +
      'state — see `INSTANCE_ALREADY_STARTED` for `running`, `INSTANCE_ALREADY_CLOSED` for ' +
      '`closed`/`finished`), 403 (caller is not the host), 404 (instance does not exist). ' +
      'Returns 200 with `{ message: "Instance started" }`.',
  })
  @instanceStartBadRequestResponse()
  @instanceForbiddenResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async startInstance(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.applicationService.startInstanceForController(instanceId, user);
    return this.presenter.startInstance(result);
  }

  // ─── POST /instances/{id}/close ────────────────────────────────────────────
  //
  // `InstanceService.closeInstance` throws (Phase 3 — issue 7.1):
  //   - `InstanceNotFoundError`        → 404 ProblemDetail
  //   - `InstanceNotHostError`         → 403 ProblemDetail
  //   - `InstanceAlreadyClosedError`   → 400 ProblemDetail  (status = 'closed')
  //   - `InstanceAlreadyFinishedError` → 400 ProblemDetail  (status = 'finished')
  // 409 is NEVER thrown here.
  @Post(':id/close')
  @instanceUnauthorizedResponse()
  @ApiOkResource(CloseInstanceResponseDto, { description: 'Instance closed' })
  @ApiOperation({
    summary: 'Close instance',
    description:
      'Transitions the instance into the `closed` state. Only the host can close an instance. ' +
      'Requires a valid JWT bearer token. Possible errors: 400 (instance is already closed ' +
      '(`INSTANCE_ALREADY_CLOSED`) or already finished (`INSTANCE_ALREADY_FINISHED`), ' +
      'or malformed path UUID), 403 (caller is not the host), 404 (instance does not exist). ' +
      'Returns 200 with `{ message: "Instance closed" }`.',
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

  // ─── GET /instances/{id}/leaderboard ───────────────────────────────────────
  //
  // `InstanceService.getLeaderboard` throws `InstanceNotFoundError` on miss → 404.
  // The application service projects the leaderboard into the canonical cursor
  // pagination shape `{ items, pagination: { limit, hasNextPage, nextCursor } }`,
  // so the envelope contains a `pagination` block — the legacy "D-variant"
  // (where `pagination` was hoisted up to `data`) is no longer used.
  //
  // Phase 4 (audit issue 2.9): the leaderboard cursor is base64url-encoded
  // (unified with the rest of the codebase). The DTO docstring above the
  // `cursor` field spells that out.
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
  @instanceBadRequestResponse()
  @instanceNotFoundResponse()
  @ApiInstanceIdParam()
  async getLeaderboard(
    @Param('id', new ParseUUIDPipe({ version: '7' })) instanceId: string,
    @Query() query: GetLeaderboardQueryDto,
  ) {
    const limit = query.limit ?? 20;
    // Phase 2 (issue 2.4 — leaderboard variant): strict cursor parser
    // throws `400 BadRequestException` on malformed shape, so the
    // application service never sees `undefined` cursors.
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
