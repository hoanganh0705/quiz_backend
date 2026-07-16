/// <reference types="jest" />
/**
 * OpenAPI regression guard for the tournament module.
 *
 * Verifies:
 *   1. Every tournament endpoint that uses `:id` as a path parameter
 *      documents it as `format: uuid` in the generated OpenAPI spec —
 *      matching the runtime `ParseUUIDPipe` enforcement.
 *
 *   2. Round endpoints use `:roundId` documented as `format: uuid`.
 *
 *   3. Query parameters are documented correctly (optional with defaults).
 *
 *   4. Every tournament operation documents a response `example` so
 *      generated SDKs surface realistic payloads in their docs.
 *
 *   5. Pagination endpoints correctly document cursor vs offset pagination.
 *
 * The test reads the committed JSON file rather than booting the app, so it
 * runs fast and does not depend on any infrastructure. Run `npm run
 * generate:openapi` after wiring a new decorator to keep this file in sync.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type OpenApiPath = Record<string, unknown>;
type OpenApiSpec = {
  paths: Record<string, OpenApiPath>;
  components?: { schemas?: Record<string, unknown> };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const findPathParam = (
  pathObj: OpenApiPath,
  method: string,
  paramName: string,
): Record<string, unknown> | undefined => {
  const op = pathObj[method] as Record<string, unknown> | undefined;
  const params = (op?.parameters as Array<Record<string, unknown>>) ?? [];
  return params.find((p) => p.name === paramName);
};

const getExample = (pathObj: OpenApiPath, method: string, status: string): unknown => {
  const op = pathObj[method] as Record<string, unknown> ?? {};
  const responses = (op.responses as Record<string, Record<string, unknown>>) ?? {};
  const respObj = responses[status] ?? {};
  const content = (respObj.content as Record<string, Record<string, unknown>>) ?? {};
  return content['application/json']?.example;
};

describe('Tournament module — OpenAPI contract', () => {
  let spec: OpenApiSpec;

  beforeAll(() => {
    const specPath = join(__dirname, '..', '..', '..', '..', 'docs', 'generated', 'openapi.json');
    spec = JSON.parse(readFileSync(specPath, 'utf-8')) as OpenApiSpec;
  });

  // ── 1. :id path parameters are documented as UUID ────────────────────────

  describe(':id path parameters document format: uuid', () => {
    const idEndpoints: Array<[string, string]> = [
      ['/api/v1/tournaments/{id}', 'get'], // getTournamentById
      ['/api/v1/tournaments/{id}/stats', 'get'], // getTournamentStats
      ['/api/v1/tournaments/{id}/winners', 'get'], // getTournamentWinners
      ['/api/v1/tournaments/{id}/leaderboard', 'get'], // getLeaderboard
      ['/api/v1/tournaments/{id}/participants', 'get'], // getTournamentParticipants
      ['/api/v1/tournaments/{id}/related', 'get'], // getRelatedTournaments
      ['/api/v1/tournaments/{id}/register', 'post'], // registerForTournament
      ['/api/v1/tournaments/{id}/register', 'delete'], // unregisterFromTournament
      ['/api/v1/tournaments/{id}/withdraw', 'post'], // withdrawFromTournament
      ['/api/v1/tournaments/{id}/my-standing', 'get'], // getMyTournamentStanding
    ];

    it.each(idEndpoints)('%s [%s] has :id with format=uuid', (route, method) => {
      const pathObj = spec.paths[route];
      expect(pathObj).toBeDefined();
      const idParam = findPathParam(pathObj, method, 'id');
      expect(idParam).toBeDefined();

      const schema = (idParam?.schema as Record<string, unknown>) ?? {};
      expect(schema.format).toBe('uuid');
      expect(schema.type).toBe('string');
    });
  });

  // ── 2. :roundId path parameters are documented as UUID ─────────────────

  describe(':roundId path parameters document format: uuid', () => {
    const roundEndpoints: Array<[string, string]> = [
      ['/api/v1/tournaments/{id}/rounds/{roundId}/attempts', 'post'], // startRoundAttempt
    ];

    it.each(roundEndpoints)('%s [%s] has :roundId with format=uuid', (route, method) => {
      const pathObj = spec.paths[route];
      expect(pathObj).toBeDefined();
      const roundIdParam = findPathParam(pathObj, method, 'roundId');
      expect(roundIdParam).toBeDefined();

      const schema = (roundIdParam?.schema as Record<string, unknown>) ?? {};
      expect(schema.format).toBe('uuid');
      expect(schema.type).toBe('string');
    });
  });

  // ── 3. Query parameters are documented correctly ─────────────────────────

  describe('query parameters are documented correctly', () => {
    it('listTournaments documents cursor and limit as optional', () => {
      const pathObj = spec.paths['/api/v1/tournaments'];
      const getOp = pathObj?.get as Record<string, unknown>;
      expect(getOp).toBeDefined();

      const params = (getOp?.parameters as Array<Record<string, unknown>>) ?? [];
      const cursorParam = params.find((p) => p.name === 'cursor');
      const limitParam = params.find((p) => p.name === 'limit');

      expect(cursorParam).toBeDefined();
      expect(limitParam).toBeDefined();
    });

    it('upcoming tournaments documents sortBy with enum values', () => {
      const pathObj = spec.paths['/api/v1/tournaments/upcoming'];
      const getOp = pathObj?.get as Record<string, unknown>;
      expect(getOp).toBeDefined();

      const params = (getOp?.parameters as Array<Record<string, unknown>>) ?? [];
      const sortByParam = params.find((p) => p.name === 'sortBy');

      expect(sortByParam).toBeDefined();
      const schema = sortByParam?.schema as Record<string, unknown>;
      expect(schema?.enum).toEqual(['startAt', 'registrationDeadline']);
    });
  });

  // ── 4. Every operation documents a response example ──────────────────

  describe('Phase 4 — every tournament operation documents a response example', () => {
    const tournamentOps: Array<[string, string, string]> = [
      // path, method, status
      ['/api/v1/tournaments', 'get', '200'], // listTournaments
      ['/api/v1/tournaments', 'post', '201'], // createTournament
      ['/api/v1/tournaments/upcoming', 'get', '200'], // getUpcomingTournaments
      ['/api/v1/tournaments/active', 'get', '200'], // getActiveTournaments
      ['/api/v1/tournaments/completed', 'get', '200'], // getCompletedTournaments
      ['/api/v1/tournaments/{id}', 'get', '200'], // getTournamentById
      ['/api/v1/tournaments/{id}/leaderboard', 'get', '200'], // getLeaderboard
      ['/api/v1/tournaments/{id}/my-standing', 'get', '200'], // getMyTournamentStanding
      ['/api/v1/tournaments/{id}/participants', 'get', '200'], // getTournamentParticipants
      ['/api/v1/tournaments/{id}/register', 'post', '200'], // registerForTournament
      ['/api/v1/tournaments/{id}/register', 'delete', '200'], // unregisterFromTournament
      ['/api/v1/tournaments/{id}/related', 'get', '200'], // getRelatedTournaments
      ['/api/v1/tournaments/{id}/rounds/{roundId}/attempts', 'post', '200'], // startRoundAttempt
      ['/api/v1/tournaments/{id}/stats', 'get', '200'], // getTournamentStats
      ['/api/v1/tournaments/{id}/winners', 'get', '200'], // getTournamentWinners
      ['/api/v1/tournaments/{id}/withdraw', 'post', '200'], // withdrawFromTournament
    ];

    it.each(tournamentOps)('%s [%s] has response example for status %s', (route, method, status) => {
      const pathObj = spec.paths[route];
      expect(pathObj).toBeDefined();

      const example = getExample(pathObj, method, status);
      expect(example).toBeDefined();

      // Each example must be a `{ data, meta }` envelope object
      const env = example as Record<string, unknown>;
      expect(env).toHaveProperty('data');
      expect(env).toHaveProperty('meta');
      expect(env.meta as Record<string, unknown>).toHaveProperty('timestamp');
    });

    it('lists all 16 tournament operations', () => {
      expect(tournamentOps).toHaveLength(16);
    });
  });

  // ── 5. Pagination kind is correctly documented ──────────────────────────

  describe('pagination kind is correctly documented', () => {
    it('listTournaments uses cursor pagination', () => {
      const example = getExample(spec.paths['/api/v1/tournaments'], 'get', '200');
      const env = example as Record<string, unknown>;
      const meta = env.meta as Record<string, unknown>;
      const pagination = meta.pagination as Record<string, unknown>;
      expect(pagination.kind).toBe('cursor');
    });

    it('getUpcomingTournaments uses offset pagination', () => {
      const example = getExample(spec.paths['/api/v1/tournaments/upcoming'], 'get', '200');
      const env = example as Record<string, unknown>;
      const meta = env.meta as Record<string, unknown>;
      const pagination = meta.pagination as Record<string, unknown>;
      expect(pagination.kind).toBe('offset');
    });

    it('getActiveTournaments uses offset pagination', () => {
      const example = getExample(spec.paths['/api/v1/tournaments/active'], 'get', '200');
      const env = example as Record<string, unknown>;
      const meta = env.meta as Record<string, unknown>;
      const pagination = meta.pagination as Record<string, unknown>;
      expect(pagination.kind).toBe('offset');
    });

    it('getCompletedTournaments uses offset pagination', () => {
      const example = getExample(spec.paths['/api/v1/tournaments/completed'], 'get', '200');
      const env = example as Record<string, unknown>;
      const meta = env.meta as Record<string, unknown>;
      const pagination = meta.pagination as Record<string, unknown>;
      expect(pagination.kind).toBe('offset');
    });

    it('getTournamentParticipants uses offset pagination', () => {
      const example = getExample(spec.paths['/api/v1/tournaments/{id}/participants'], 'get', '200');
      const env = example as Record<string, unknown>;
      const meta = env.meta as Record<string, unknown>;
      const pagination = meta.pagination as Record<string, unknown>;
      expect(pagination.kind).toBe('offset');
    });
  });
});
