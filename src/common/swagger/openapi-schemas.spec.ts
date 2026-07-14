/// <reference types="jest" />
/**
 * Phase 1.2 / 1.6 backstop of `docs/migrations/USER_MODULE_CONTRACT_HARDENING.md`.
 *
 * Loads the committed OpenAPI document (`docs/generated/openapi.json`) and asserts:
 *
 *   1. All schemas referenced via `$ref` resolve to entries in
 *      `components.schemas` — no broken links.
 *
 *   2. `WrappedDto`, `WrappedPaginatedDto`, `ResponseMetaDto`, and
 *      `PaginatedResponseMetaDto` are present in `components.schemas`.
 *      (These were missing before Phase 1.2 because generic wrapper DTOs were
 *       never passed to `ApiExtraModels()`.)
 *
 *   3. Specific user-module endpoints use the correct wrapper shapes.
 *
 * This test is a **permanent regression guard**: if a developer adds a new
 * `@ApiOkResource` / `@ApiOkResourceList` / `@ApiOkResourceArray` call without
 * including the wrapper DTOs in `ApiExtraModels`, this test will catch the
 * broken refs on the next CI run.
 *
 * The test reads the committed JSON file rather than booting the app, so it
 * runs fast and does not depend on any infrastructure (DB, Redis) or on
 * Swagger being set up in the test environment.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Recursively collect every `$ref` value found in a plain JS value tree. */
function collectRefs(value: unknown, refs: Set<string>): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return;
  }
  for (const [, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v.match(/^#\//)) {
      refs.add(v);
    } else {
      collectRefs(v, refs);
    }
  }
}

describe('OpenAPI document — schema integrity (Phase 1.2 / 1.6 backstop)', () => {
  let spec: Record<string, unknown>;
  let schemas: Record<string, unknown>;

  beforeAll(() => {
    // __dirname = src/common/swagger; go up 3 levels to the project root
    const specPath = join(__dirname, '..', '..', '..', 'docs', 'generated', 'openapi.json');
    spec = JSON.parse(readFileSync(specPath, 'utf-8')) as Record<string, unknown>;
    schemas =
      ((spec.components as Record<string, unknown>)?.schemas as Record<string, unknown>) ?? {};
  });

  // ── 1. Document structure ───────────────────────────────────────────────────

  describe('document structure', () => {
    it('has a components.schemas section', () => {
      expect(spec).toHaveProperty('components.schemas');
    });

    it('has a paths section', () => {
      expect(spec).toHaveProperty('paths');
    });
  });

  // ── 2. Schema-ref integrity ─────────────────────────────────────────────────

  describe('all $ref values resolve to a schema', () => {
    it('has no broken $ref links across the entire document', () => {
      const schemaNames = new Set(Object.keys(schemas));

      const allRefs = new Set<string>();
      collectRefs(spec, allRefs);

      const brokenRefs = [...allRefs].filter((ref) => {
        if (!ref.startsWith('#/components/schemas/')) return false;
        const name = ref.replace('#/components/schemas/', '');
        return !schemaNames.has(name);
      });

      expect(brokenRefs.sort()).toEqual([]);
    });
  });

  // ── 3. Envelope schemas are registered ─────────────────────────────────────

  describe('envelope wrapper schemas are emitted in components.schemas', () => {
    it('includes WrappedDto', () => {
      expect(schemas).toHaveProperty('WrappedDto');
    });

    it('includes WrappedPaginatedDto', () => {
      expect(schemas).toHaveProperty('WrappedPaginatedDto');
    });

    it('includes ResponseMetaDto', () => {
      expect(schemas).toHaveProperty('ResponseMetaDto');
    });

    it('includes PaginatedResponseMetaDto', () => {
      expect(schemas).toHaveProperty('PaginatedResponseMetaDto');
    });
  });

  // ── 4. User-module structural checks ────────────────────────────────────────

  describe('user-module endpoints use correct wrapper shapes', () => {
    const getOpSchema = (path: string) => {
      const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
      const pathObj = paths[`/api/v1${path}`] ?? {};
      const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
      const responses = (getOp.responses as Record<string, unknown>) ?? {};
      return responses['200'];
    };

    it('GET /api/v1/users/me has a WrappedDto-shaped 200 response', () => {
      const schema = getOpSchema('/users/me');
      expect(schema).toBeDefined();
      const schemaStr = JSON.stringify(schema);
      expect(schemaStr).toContain('WrappedDto');
    });

    it('GET /api/v1/users/me/badges has a WrappedPaginatedDto-shaped 200 response', () => {
      const schema = getOpSchema('/users/me/badges');
      expect(schema).toBeDefined();
      const schemaStr = JSON.stringify(schema);
      expect(schemaStr).toContain('WrappedPaginatedDto');
    });

    it('GET /api/v1/users/me/ranking has a WrappedDto-shaped 200 response', () => {
      const schema = getOpSchema('/users/me/ranking');
      expect(schema).toBeDefined();
      const schemaStr = JSON.stringify(schema);
      expect(schemaStr).toContain('WrappedDto');
    });
  });

  // ── 5. Phase 2 regression guards ─────────────────────────────────────────────

  describe('Phase 2 — H1: list-item schemas point to ItemDto, not wrapper DTOs', () => {
    const getDataItemsRefName = (path: string): string | undefined => {
      const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
      const pathObj = paths[`/api/v1${path}`] ?? {};
      const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
      const responses = (getOp.responses as Record<string, unknown>) ?? {};
      const resp200 = responses['200'] as Record<string, unknown>;
      const content = (resp200?.content as Record<string, unknown>)?.['application/json'] as Record<
        string,
        unknown
      >;
      const schema = (content?.schema as Record<string, unknown>) ?? {};
      const allOf = schema.allOf as Array<Record<string, unknown>> | undefined;
      const inner = allOf?.[1] as Record<string, unknown>;
      const data = (inner?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
      // data = { type: 'array', items: { $ref: '...' } }
      // → items is { $ref: '...' }, not { type, items }
      const items = (data?.items as Record<string, unknown>) ?? {};
      return (items['$ref'] as string | undefined)?.replace('#/components/schemas/', '');
    };

    it('GET /api/v1/users/me/badges data items are UserBadgeItemDto, not UserBadgesResponseDto', () => {
      const ref = getDataItemsRefName('/users/me/badges');
      expect(ref).toBe('UserBadgeItemDto');
      expect(ref).not.toBe('UserBadgesResponseDto');
    });

    it('GET /api/v1/users/:userId/badges data items are UserBadgeItemDto', () => {
      const ref = getDataItemsRefName('/users/{userId}/badges');
      expect(ref).toBe('UserBadgeItemDto');
    });

    it('GET /api/v1/users/me/activity data items are UserActivityItemDto, not UserActivityResponseDto', () => {
      const ref = getDataItemsRefName('/users/me/activity');
      expect(ref).toBe('UserActivityItemDto');
      expect(ref).not.toBe('UserActivityResponseDto');
    });
  });

  describe('Phase 2 — H2: recommended-quizzes uses bare-array envelope, not paginated', () => {
    const getSchemaKind = (path: string): 'paginated' | 'bare-array' | 'unknown' => {
      const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
      const pathObj = paths[`/api/v1${path}`] ?? {};
      const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
      const responses = (getOp.responses as Record<string, unknown>) ?? {};
      const resp200 = responses['200'] as Record<string, unknown>;
      const content = (resp200?.content as Record<string, unknown>)?.['application/json'] as Record<
        string,
        unknown
      >;
      const schema = (content?.schema as Record<string, unknown>) ?? {};
      const schemaStr = JSON.stringify(schema);
      if (schemaStr.includes('WrappedPaginatedDto')) return 'paginated';
      if (schemaStr.includes('WrappedDto') && !schemaStr.includes('WrappedPaginatedDto'))
        return 'bare-array';
      return 'unknown';
    };

    it('GET /api/v1/users/me/recommended-quizzes uses bare-array (WrappedDto), not WrappedPaginatedDto', () => {
      const kind = getSchemaKind('/users/me/recommended-quizzes');
      expect(kind).toBe('bare-array');
    });

    it('GET /api/v1/users/me/recommended-quizzes data items are QuizListItemDto', () => {
      const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
      const pathObj = paths['/api/v1/users/me/recommended-quizzes'] ?? {};
      const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
      const responses = (getOp.responses as Record<string, unknown>) ?? {};
      const resp200 = responses['200'] as Record<string, unknown>;
      const content = (resp200?.content as Record<string, unknown>)?.['application/json'] as Record<
        string,
        unknown
      >;
      const schema = (content?.schema as Record<string, unknown>) ?? {};
      const allOf = schema.allOf as Array<Record<string, unknown>> | undefined;
      const inner = allOf?.[1] as Record<string, unknown>;
      const data = (inner?.properties as Record<string, unknown>)?.data as Record<string, unknown>;
      // data = { type: 'array', items: { $ref: '...' } }
      // data = { type: 'array', items: { $ref: '...' } }
      // → data.items is { $ref: '...' }, not { type, items }
      expect(data?.type).toBe('array');
      const itemRef = (
        (data?.items as Record<string, unknown>)?.['$ref'] as string | undefined
      )?.replace('#/components/schemas/', '');
      expect(itemRef).toBe('QuizListItemDto');
    });
  });

  describe('Phase 2 — H6: :userId/* routes document BearerAuth security', () => {
    const userIdEndpoints = [
      '/users/{userId}/quizzes/analytics',
      '/users/{userId}/quizzes',
      '/users/{userId}/badges',
      '/users/{userId}/tournament-history',
      '/users/{userId}/tournaments',
    ];

    for (const ep of userIdEndpoints) {
      it(`${ep} declares BearerAuth security`, () => {
        const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
        const pathObj = paths[`/api/v1${ep}`] ?? {};
        const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
        const security = getOp.security as Array<Record<string, unknown>> | undefined;
        expect(security).toBeDefined();
        expect(security?.some((s) => Object.prototype.hasOwnProperty.call(s, 'BearerAuth'))).toBe(
          true,
        );
      });

      it(`${ep} documents a 401 response`, () => {
        const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
        const pathObj = paths[`/api/v1${ep}`] ?? {};
        const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
        const responses = (getOp.responses as Record<string, unknown>) ?? {};
        expect(responses).toHaveProperty('401');
      });
    }
  });

  // ── 6. Phase 3 regression guards ─────────────────────────────────────────────

  describe('Phase 3 — M5: :userId path param documented as uuid format', () => {
    const userIdEndpoints = [
      '/users/{userId}/quizzes/analytics',
      '/users/{userId}/quizzes',
      '/users/{userId}/badges',
      '/users/{userId}/tournament-history',
      '/users/{userId}/tournaments',
    ];

    for (const ep of userIdEndpoints) {
      it(`${ep} has userId param with format: uuid`, () => {
        const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
        const pathObj = paths[`/api/v1${ep}`] ?? {};
        const getOp = (pathObj['get'] as Record<string, unknown>) ?? {};
        const params = getOp.parameters as Array<Record<string, unknown>> | undefined;
        const userIdParam = params?.find((p) => p.name === 'userId');
        expect(userIdParam).toBeDefined();
        const schema = (userIdParam?.schema as Record<string, unknown>) ?? {};
        expect(schema.format).toBe('uuid');
        expect(userIdParam?.in).toBe('path');
        expect(userIdParam?.required).toBe(true);
      });
    }
  });
});
