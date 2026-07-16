/**
 * Tournament module Swagger decorators.
 *
 * Phase 3 of `docs/audits/TOURNAMENT_API_CONTRACT_AUDIT.md`.
 */
import { ApiParam } from '@nestjs/swagger';

/**
 * Documents the `:id` path parameter as `format: uuid` on tournament resource
 * endpoints. Runtime `ParseUUIDPipe` enforces this at the NestJS level; this
 * decorator mirrors it in the OpenAPI spec so generated SDK clients know to
 * send UUIDs.
 *
 * Applied to protected endpoints that don't otherwise document the `id` param
 * explicitly (the `@nestjs/swagger` plugin only auto-generates path-param
 * documentation for some controller patterns).
 */
export const ApiTournamentIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'id',
    description: 'UUID of the tournament',
    format: 'uuid',
  });

/**
 * Documents the `:roundId` path parameter as `format: uuid` on tournament round
 * endpoints.
 */
export const ApiTournamentRoundIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'roundId',
    description: 'UUID of the tournament round',
    format: 'uuid',
  });
