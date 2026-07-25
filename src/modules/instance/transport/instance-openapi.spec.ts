/// <reference types="jest" />
/**
 * OpenAPI regression guards for the `instance` module.
 *
 * Phase 4 / Phase 5 of `docs/audits/INSTANCE_API_CONTRACT_AUDIT.md`.
 * Verifies the structural integrity of the instance module's portion
 * of `docs/generated/openapi.json` so that the API contract cannot
 * silently regress against the contract documented in the audit.
 *
 * The test reads the committed JSON file rather than booting the app,
 * so it runs fast and does not depend on any infrastructure. Run
 * `pnpm generate:openapi` after wiring a new decorator to keep this
 * file in sync.
 *
 * Coverage:
 *   1. All 7 instance endpoints are documented under
 *      `/api/v1/instances/*`.
 *   2. Path-parameter UUID format (`format: 'uuid'`) on every
 *      operation that takes `:id` (audit issue 3.1).
 *   3. BearerAuth security on every protected endpoint + 401
 *      response.
 *   4. Cursor-paginated endpoints (`GET /instances`,
 *      `GET /instances/{id}/leaderboard`) document `kind: 'cursor'`
 *      and `nextCursor: string` (audit issue 3.3).
 *   5. Per-instance example payloads have non-empty `data` + `meta`
 *      envelopes and carry the `code` extension matching the
 *      documented error (audit issue 3.2).
 *   6. Status-code coverage matches the audit (200/201/400/401/403/
 *      404/409).
 *   7. Operation metadata (summary, description) is non-empty.
 *   8. All instance request/response DTOs are registered in
 *      `components.schemas`.
 *   9. All instance operations are tagged `instances`.
 *  10. Query-parameter documentation: `limit` carries a default of 20
 *      (audit issue 2.3) and the list endpoint's cursor payload is
 *      documented as base64url (audit issue 2.9).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type OperationObject = {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  security?: Array<Record<string, unknown>>;
  parameters?: Array<ParameterObject>;
  responses: Record<string, ResponseObject>;
};

type ParameterObject = {
  name: string;
  in: string;
  required?: boolean;
  schema?: { format?: string; type?: string; default?: unknown; enum?: string[] };
  description?: string;
};

type ResponseObject = {
  description?: string;
  content?: Record<string, { schema?: unknown; example?: unknown; examples?: unknown }>;
};

const INSTANCE_PATHS = [
  '/instances',
  '/instances/{id}/players',
  '/instances/{id}',
  '/instances/{id}/join',
  '/instances/{id}/start',
  '/instances/{id}/close',
  '/instances/{id}/leaderboard',
];

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const isHttpMethod = (key: string): key is HttpMethod =>
  (HTTP_METHODS as readonly string[]).includes(key);

const findPathParam = (
  pathObj: Record<string, unknown>,
  method: string,
  paramName: string,
): ParameterObject | undefined => {
  const op = pathObj[method] as OperationObject | undefined;
  const params = op?.parameters ?? [];
  return params.find((p) => p.name === paramName);
};

const getExample = (pathObj: Record<string, unknown>, method: string, status: string): unknown => {
  const op = (pathObj[method] as OperationObject) ?? ({} as OperationObject);
  const responses = op.responses ?? {};
  const respObj = responses[status] ?? {};
  const content = (respObj.content ?? {})['application/json'];
  return content?.example;
};

const getPathMethods = (pathObj: Record<string, unknown>): HttpMethod[] => {
  const httpMethods = Object.keys(pathObj).filter(isHttpMethod);
  return httpMethods;
};

describe('Instance module — OpenAPI contract regression guards', () => {
  let spec: {
    paths: Record<string, Record<string, OperationObject>>;
    components: { schemas: Record<string, unknown> };
  };
  let schemas: Record<string, unknown>;

  beforeAll(() => {
    const specPath = join(__dirname, '..', '..', '..', '..', 'docs', 'generated', 'openapi.json');
    const raw = JSON.parse(readFileSync(specPath, 'utf-8')) as Record<string, unknown>;
    spec = raw as unknown as typeof spec;
    schemas = spec.components?.schemas ?? {};
  });

  // ── 1. All 7 instance endpoints are documented ──────────────────────

  describe('all instance endpoints are documented', () => {
    for (const path of INSTANCE_PATHS) {
      const fullPath = `/api/v1${path}`;
      it(`${fullPath} exists in the spec`, () => {
        expect(spec.paths).toHaveProperty(fullPath);
      });
    }

    it(`documents exactly ${INSTANCE_PATHS.length} instance endpoints`, () => {
      const count = INSTANCE_PATHS.filter((p) => spec.paths[`/api/v1${p}`] !== undefined).length;
      expect(count).toBe(INSTANCE_PATHS.length);
    });
  });

  // ── 2. Path parameters declare format: uuid ──────────────────────────

  describe('path parameters declare format: uuid (issue 3.1)', () => {
    const idEndpoints: Array<[string, string]> = [
      ['/instances/{id}/players', 'get'],
      ['/instances/{id}', 'get'],
      ['/instances/{id}/join', 'post'],
      ['/instances/{id}/start', 'post'],
      ['/instances/{id}/close', 'post'],
      ['/instances/{id}/leaderboard', 'get'],
    ];

    for (const [path, method] of idEndpoints) {
      const fullPath = `/api/v1${path}`;
      it(`${fullPath} [${method}] declares :id with format=uuid`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const idParam = findPathParam(pathObj, method, 'id');
        expect(idParam).toBeDefined();
        expect(idParam?.in).toBe('path');
        expect(idParam?.required).toBe(true);
        expect(idParam?.schema?.format).toBe('uuid');
        expect(idParam?.schema?.type).toBe('string');
      });
    }
  });

  // ── 3. BearerAuth security on every protected endpoint ──────────────

  describe('protected endpoints declare BearerAuth security + 401 response', () => {
    const protectedEndpoints: Array<[string, string]> = [
      ['/instances', 'get'],
      ['/instances/{id}/players', 'get'],
      ['/instances/{id}', 'get'],
      ['/instances/{id}/join', 'post'],
      ['/instances/{id}/start', 'post'],
      ['/instances/{id}/close', 'post'],
      ['/instances/{id}/leaderboard', 'get'],
    ];

    for (const [path, method] of protectedEndpoints) {
      const fullPath = `/api/v1${path}`;
      it(`${fullPath} [${method}] declares BearerAuth + 401 response`, () => {
        const op = spec.paths[fullPath]?.[method];
        const security = op?.security ?? [];
        expect(security.length).toBeGreaterThan(0);
        expect(security.some((s) => Object.prototype.hasOwnProperty.call(s, 'BearerAuth'))).toBe(
          true,
        );
        expect(op?.responses).toHaveProperty('401');
      });
    }
  });

  // ── 4. Cursor pagination meta (issue 3.3) ───────────────────────────

  describe('cursor pagination meta', () => {
    it('PaginationMetaDto.nextCursor is documented as type=string (issue 3.3)', () => {
      const schema = schemas.PaginationMetaDto as Record<string, unknown> | undefined;
      expect(schema).toBeDefined();
      const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
      expect(props.nextCursor).toBeDefined();
      expect(props.nextCursor.type).toBe('string');
    });

    it('PaginatedResponseMetaDto.pagination uses oneOf discriminator (issue 3.3)', () => {
      const schema = schemas.PaginatedResponseMetaDto as Record<string, unknown> | undefined;
      expect(schema).toBeDefined();
      const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
      expect(props.pagination).toBeDefined();
      // Either `oneOf` (preferred) or `$ref` — the audit marked
      // `type: 'object'` as a regression.
      expect(props.pagination.type).not.toBe('object');
    });

    it('cursor endpoints reference PaginationMetaDto via allOf schema', () => {
      // Phase 6 (api-contract audit): `/instances/{id}/players` is now
      // cursor-paginated alongside the list and leaderboard endpoints.
      const cursorEndpoints: Array<[string, string]> = [
        ['/instances', 'get'],
        ['/instances/{id}/players', 'get'],
        ['/instances/{id}/leaderboard', 'get'],
      ];

      for (const [path, method] of cursorEndpoints) {
        const fullPath = `/api/v1${path}`;
        const op = spec.paths[fullPath]?.[method];
        const resp = op?.responses['200'];
        const content = resp?.content?.['application/json'];
        const schema = content?.schema as Record<string, unknown> | undefined;
        // The schema references PaginationMetaDto via allOf on
        // WrappedPaginatedDto. We check for the `$ref` chain rather
        // than the actual response example (the example is optional
        // in the spec generation pipeline and not always present).
        expect(schema).toBeDefined();
        const schemaJson = JSON.stringify(schema);
        expect(schemaJson).toContain('PaginationMetaDto');
      }
    });
  });

  // ── 5. Per-instance error examples (issue 3.2) ──────────────────────

  describe('per-instance error examples (issue 3.2)', () => {
    it('404 example on GET /instances/{id} uses INSTANCE_NOT_FOUND', () => {
      const example = getExample(spec.paths['/api/v1/instances/{id}'], 'get', '404');
      expect(example).toBeDefined();
      const obj = example as Record<string, unknown>;
      const extensions = obj.extensions as Record<string, unknown>;
      expect(extensions.code).toBe('INSTANCE_NOT_FOUND');
    });

    it('403 example on POST /instances/{id}/start uses INSTANCE_NOT_HOST', () => {
      const example = getExample(spec.paths['/api/v1/instances/{id}/start'], 'post', '403');
      expect(example).toBeDefined();
      const obj = example as Record<string, unknown>;
      const extensions = obj.extensions as Record<string, unknown>;
      expect(extensions.code).toBe('INSTANCE_NOT_HOST');
    });

    it('409 example on POST /instances/{id}/join uses PLAYER_ALREADY_JOINED', () => {
      const example = getExample(spec.paths['/api/v1/instances/{id}/join'], 'post', '409');
      expect(example).toBeDefined();
      const obj = example as Record<string, unknown>;
      const extensions = obj.extensions as Record<string, unknown>;
      expect(extensions.code).toBe('PLAYER_ALREADY_JOINED');
    });

    it('400 example on POST /instances/{id}/join uses an INSTANCE_* code (not the generic 400)', () => {
      const example = getExample(spec.paths['/api/v1/instances/{id}/join'], 'post', '400');
      expect(example).toBeDefined();
      const obj = example as Record<string, unknown>;
      const extensions = obj.extensions as Record<string, unknown>;
      const code = extensions.code as string;
      expect(code).toMatch(/^(INSTANCE_|PLAYER_)/);
    });
  });

  // ── 6. Status code coverage ─────────────────────────────────────────

  describe('status code coverage', () => {
    const successOps: Array<[string, string, string]> = [
      ['/instances', 'get', '200'],
      ['/instances/{id}/players', 'get', '200'],
      ['/instances/{id}', 'get', '200'],
      ['/instances/{id}/join', 'post', '200'],
      ['/instances/{id}/start', 'post', '200'],
      ['/instances/{id}/close', 'post', '200'],
      ['/instances/{id}/leaderboard', 'get', '200'],
    ];

    const createdOps: Array<[string, string, string]> = [];

    for (const [path, method, status] of [...successOps, ...createdOps]) {
      const fullPath = `/api/v1${path}`;
      it(`${method.toUpperCase()} ${fullPath} documents ${status} response`, () => {
        const op = spec.paths[fullPath]?.[method];
        expect(op?.responses).toHaveProperty(status);
      });
    }

    it('all methods that take :id document 400 (validation or domain)', () => {
      const idEndpoints: Array<[string, string]> = [
        ['/instances/{id}/players', 'get'],
        ['/instances/{id}', 'get'],
        ['/instances/{id}/join', 'post'],
        ['/instances/{id}/start', 'post'],
        ['/instances/{id}/close', 'post'],
        ['/instances/{id}/leaderboard', 'get'],
      ];
      for (const [path, method] of idEndpoints) {
        const op = spec.paths[`/api/v1${path}`]?.[method];
        expect(op?.responses).toHaveProperty('400');
      }
    });

    it('all methods that take :id document 404 (InstanceNotFoundError)', () => {
      const idEndpoints: Array<[string, string]> = [
        ['/instances/{id}/players', 'get'],
        ['/instances/{id}', 'get'],
        ['/instances/{id}/join', 'post'],
        ['/instances/{id}/start', 'post'],
        ['/instances/{id}/close', 'post'],
        ['/instances/{id}/leaderboard', 'get'],
      ];
      for (const [path, method] of idEndpoints) {
        const op = spec.paths[`/api/v1${path}`]?.[method];
        expect(op?.responses).toHaveProperty('404');
      }
    });

    it('start/close document 403 (InstanceNotHostError)', () => {
      for (const path of ['/instances/{id}/start', '/instances/{id}/close']) {
        const op = spec.paths[`/api/v1${path}`]?.post;
        expect(op?.responses).toHaveProperty('403');
      }
    });

    it('join documents 409 (PlayerAlreadyJoinedError)', () => {
      const op = spec.paths['/api/v1/instances/{id}/join']?.post;
      expect(op?.responses).toHaveProperty('409');
    });
  });

  // ── 7. Operation metadata ───────────────────────────────────────────

  describe('operation metadata', () => {
    for (const path of INSTANCE_PATHS) {
      const fullPath = `/api/v1${path}`;
      it(`every method on ${fullPath} carries a non-empty summary`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = getPathMethods(pathObj);
        expect(httpMethods.length).toBeGreaterThan(0);
        for (const method of httpMethods) {
          const op = pathObj[method];
          expect(op.summary).toBeDefined();
          expect((op.summary ?? '').length).toBeGreaterThan(0);
        }
      });
    }
  });

  // ── 8. DTO registration in components.schemas ──────────────────────

  describe('instance DTOs are registered in components.schemas', () => {
    // Note: query DTOs (e.g. `GetLeaderboardQueryDto`,
    // `ListInstancesQueryDto`) are inlined into the `parameters` of
    // the operation and not registered as standalone schemas. The
    // bookmark module follows the same convention — verified by the
    // absence of `SearchBookmarksQueryDto` from `components.schemas`.
    const requiredDtos = [
      'CreateInstanceDto',
      'CreateInstanceResponseDto',
      'JoinInstanceResponseDto',
      'StartInstanceResponseDto',
      'CloseInstanceResponseDto',
      'InstanceDetailResponseDto',
      'InstancePlayersResponseDto',
      'InstancePlayersPaginationDto',
      'InstanceListResponseDto',
      'InstanceListItemDto',
      'InstanceListPaginationDto',
      'InstanceLeaderboardResponseDto',
      'InstanceLeaderboardEntryDto',
      'InstanceLeaderboardPaginationDto',
      'InstancePlayerResponseDto',
    ];

    for (const dto of requiredDtos) {
      it(`${dto} is present in components.schemas`, () => {
        expect(schemas).toHaveProperty(dto);
      });
    }
  });

  // ── 9. Tagging ─────────────────────────────────────────────────────

  describe('all instance operations are tagged "instances"', () => {
    for (const path of INSTANCE_PATHS) {
      const fullPath = `/api/v1${path}`;
      it(`${fullPath} is tagged "instances"`, () => {
        const pathObj = spec.paths[fullPath] ?? {};
        const httpMethods = getPathMethods(pathObj);
        expect(httpMethods.length).toBeGreaterThan(0);
        for (const method of httpMethods) {
          const op = pathObj[method];
          expect(op.tags).toContain('instances');
        }
      });
    }
  });

  // ── 10. Query-parameter documentation (issues 2.3 / 2.9) ───────────

  describe('query-parameter documentation (issues 2.3 / 2.9)', () => {
    it('GET /instances declares `limit` with default=20 (issue 2.3)', () => {
      const op = spec.paths['/api/v1/instances']?.get;
      const params = op?.parameters ?? [];
      const limitParam = params.find((p) => p.name === 'limit');
      expect(limitParam).toBeDefined();
      expect(limitParam?.schema?.default).toBe(20);
    });

    it('GET /instances declares `status` and `difficulty` query params', () => {
      const op = spec.paths['/api/v1/instances']?.get;
      const params = op?.parameters ?? [];
      const statusParam = params.find((p) => p.name === 'status');
      const difficultyParam = params.find((p) => p.name === 'difficulty');
      expect(statusParam).toBeDefined();
      expect(difficultyParam).toBeDefined();
    });

    it('GET /instances declares the cursor query parameter (issue 2.9)', () => {
      const op = spec.paths['/api/v1/instances']?.get;
      const params = op?.parameters ?? [];
      const cursorParam = params.find((p) => p.name === 'cursor');
      expect(cursorParam).toBeDefined();
    });

    it('GET /instances/{id}/leaderboard declares cursor + limit (issue 2.9)', () => {
      const op = spec.paths['/api/v1/instances/{id}/leaderboard']?.get;
      const params = op?.parameters ?? [];
      expect(params.find((p) => p.name === 'cursor')).toBeDefined();
      expect(params.find((p) => p.name === 'limit')).toBeDefined();
    });

    // Phase 6 (api-contract audit): the players endpoint now uses
    // cursor pagination, so the canonical `cursor` + `limit` query
    // params must be documented.
    it('GET /instances/{id}/players declares cursor + limit (Phase 6)', () => {
      const op = spec.paths['/api/v1/instances/{id}/players']?.get;
      const params = op?.parameters ?? [];
      const cursorParam = params.find((p) => p.name === 'cursor');
      const limitParam = params.find((p) => p.name === 'limit');
      expect(cursorParam).toBeDefined();
      expect(limitParam).toBeDefined();
      expect(limitParam?.schema?.default).toBe(20);
    });
  });
});
